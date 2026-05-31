"""
Cricket Motion Tracking System — Phase 1/2 Prototype
=====================================================
Real-time wrist tracking and rule-based swing detection using
MediaPipe Pose + OpenCV.

Architecture:
  - CONFIG          : all tuneable parameters in one place
  - WristTracker    : per-wrist state (position history, cooldown)
  - MotionAnalyzer  : stateless motion math (velocity, direction, magnitude)
  - DebugOverlay    : all HUD rendering isolated from logic
  - main()          : thin orchestration loop — reads, processes, displays

Author  : Refactored from prototype
Phase   : 1/2  (rule-based, no ML)
"""

import cv2
import mediapipe as mp
import math
import time
from collections import deque
from tracking.trajectory_tracker import TrajectoryTracker
from detectors.gesture_detector import MotionAnalyzer
from detectors.swing_sector_classifier import SwingSectorClassifier
from detectors.batting_zone_classifier import BattingZoneClassifier
from detectors.shot_classifier import ShotClassifier
from gameplay.swing_event import SwingEvent
from gameplay.virtual_bat import VirtualBat
from gameplay.ball import Ball

# ─────────────────────────────────────────────
# CONFIGURATION
# All thresholds in one dict — easy to tune or
# later load from a JSON/YAML settings file.
# ─────────────────────────────────────────────
CONFIG = {
    # Minimum average velocity (px/frame) to register a swing
    "swing_velocity_threshold": 18,

    # How many frames to lock out after a swing fires (prevents flicker)
    "swing_cooldown_frames": 20,

    # Rolling window size for velocity smoothing
    # Larger = smoother but slightly more lag
    "velocity_smoothing_window": 5,

    # Minimum displacement magnitude for direction to be reported
    "direction_magnitude_threshold": 8,

    # Webcam device index
    "camera_index": 0,
}

# ─────────────────────────────────────────────
# MEDIAPIPE SETUP
# ─────────────────────────────────────────────
mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils

# model_complexity=1 balances accuracy vs. speed.
# Set to 0 for lower-end hardware.
pose = mp_pose.Pose(
    model_complexity=1,
    smooth_landmarks=True,       # MediaPipe built-in landmark smoothing
    min_detection_confidence=0.6,
    min_tracking_confidence=0.5,
)


# ─────────────────────────────────────────────
# WRIST TRACKER
# Holds per-wrist state so both wrists are
# tracked independently without code duplication.
# ─────────────────────────────────────────────
class WristTracker:
    """
    Tracks a single wrist's position history, velocity, and cooldown state.

    Attributes:
        name            : human label shown in HUD ("Right" / "Left")
        color           : BGR tuple for drawing
        prev_pos        : (x, y) from the last frame
        velocity_history: deque of recent per-frame speeds for smoothing
        cooldown        : frames remaining before next swing can trigger
        last_swing_dir  : direction string of the most recent swing
    """

    def __init__(self, name: str, color: tuple):
        self.name = name
        self.color = color                          # BGR
        self.prev_pos: tuple[int, int] | None = None
        self.velocity_history: deque[float] = deque(
            maxlen=CONFIG["velocity_smoothing_window"]
        )
        self.cooldown: int = 0                      # counts down each frame
        self.last_swing_dir: str = "None"
        self.swing_window_active: bool = False
        self.swing_start_position: tuple[int, int] | None = None
        self.swing_end_position: tuple[int, int] | None = None
        self.swing_peak_velocity: float = 0.0
        self.swing_duration_frames: int = 0

    def _start_swing_window(
        self,
        start_pos: tuple[int, int],
        current_pos: tuple[int, int],
        velocity: float,
    ):
        self.swing_window_active = True
        self.swing_start_position = start_pos
        self.swing_end_position = current_pos
        self.swing_peak_velocity = velocity
        self.swing_duration_frames = 1

    def _update_swing_window(
        self,
        previous_pos: tuple[int, int],
        current_pos: tuple[int, int],
        velocity: float,
        can_start: bool,
    ) -> dict | None:
        swing_threshold = CONFIG["swing_velocity_threshold"]

        if velocity > swing_threshold:
            if not self.swing_window_active:
                if can_start:
                    self._start_swing_window(previous_pos, current_pos, velocity)
            else:
                self.swing_end_position = current_pos
                self.swing_peak_velocity = max(self.swing_peak_velocity, velocity)
                self.swing_duration_frames += 1
            return None

        if not self.swing_window_active:
            return None

        self.swing_end_position = current_pos
        self.swing_peak_velocity = max(self.swing_peak_velocity, velocity)
        self.swing_duration_frames += 1

        completed_window = {
            "start_position": self.swing_start_position,
            "end_position": self.swing_end_position,
            "peak_velocity": self.swing_peak_velocity,
            "duration_frames": self.swing_duration_frames,
        }

        self.swing_window_active = False
        self.swing_start_position = None
        self.swing_end_position = None
        self.swing_peak_velocity = 0.0
        self.swing_duration_frames = 0

        return completed_window

    def update(self, current_pos: tuple[int, int]) -> dict:
        """
        Call once per frame with the current (x, y) pixel position.
        Returns a motion_data dict consumed by MotionAnalyzer and the HUD.
        """
        motion_data = {
           "dx": 0,
           "dy": 0,
           "magnitude": 0.0,
           "smoothed_velocity": 0.0,
           "direction": "None",
           "angle": 0.0,
           "sector": "NONE",
           "zone": "UNKNOWN",
           "swing_detected": False,
           "swing_window_completed": False,
           "swing_window": None,
           "in_cooldown": self.cooldown > 0,
}

        if self.prev_pos is not None:
            dx = current_pos[0] - self.prev_pos[0]
            dy = current_pos[1] - self.prev_pos[1]
            magnitude = math.hypot(dx, dy)          # Euclidean distance
            angle = math.degrees(math.atan2(dy, dx))

            if angle < 0:
                angle += 360

            # Append raw speed to rolling window
            self.velocity_history.append(magnitude)

            # Average velocity over the window — kills single-frame spikes
            smoothed_velocity = (
                sum(self.velocity_history) / len(self.velocity_history)
            )

            # Determine cardinal swing direction
            direction = MotionAnalyzer.get_direction(
                dx,
                dy,
                magnitude,
                CONFIG["direction_magnitude_threshold"],
            )
            sector = SwingSectorClassifier.classify(angle, magnitude)
                
            
            motion_data.update({
                "dx": dx,
                "dy": dy,
                "magnitude": magnitude,
                "smoothed_velocity": smoothed_velocity,
                "direction": direction,
                "angle": angle,
                "sector": sector,
            })

            completed_window = self._update_swing_window(
                self.prev_pos,
                current_pos,
                smoothed_velocity,
                self.cooldown <= 0,
            )
            if completed_window:
                motion_data["swing_window_completed"] = True
                motion_data["swing_window"] = completed_window

            # ── Swing detection with cooldown ──────────────────────────
            if self.cooldown > 0:
                self.cooldown -= 1          # burn down cooldown each frame
            else:
                if smoothed_velocity > CONFIG["swing_velocity_threshold"]:
                    motion_data["swing_detected"] = True
                    self.last_swing_dir = direction
                    self.cooldown = CONFIG["swing_cooldown_frames"]

        self.prev_pos = current_pos
        return motion_data


# ─────────────────────────────────────────────
# DEBUG OVERLAY
# All cv2.putText / cv2.circle rendering lives
# here — completely separate from detection logic.
# Comment out draw_hud() call to get a clean feed.
# ─────────────────────────────────────────────
class DebugOverlay:
    """
    Renders all debug information onto the frame.
    Keeps cv2 drawing calls out of the logic layer.
    """

    # HUD colour palette
    COLOR_GREEN  = (0, 255, 0)
    COLOR_RED    = (0, 0, 255)
    COLOR_YELLOW = (0, 255, 255)
    COLOR_WHITE  = (255, 255, 255)
    COLOR_ORANGE = (0, 165, 255)
    COLOR_CYAN   = (255, 255, 0)

    FONT = cv2.FONT_HERSHEY_SIMPLEX

    @staticmethod
    def draw_wrist_marker(
        frame, pos: tuple[int, int], color: tuple, label: str
    ):
        """Circle + coordinate label on a wrist landmark."""
        cv2.circle(frame, pos, 12, color, -1)
        cv2.circle(frame, pos, 14, (255, 255, 255), 1)   # white ring
        cv2.putText(
            frame, label, (pos[0] + 16, pos[1] + 6),
            DebugOverlay.FONT, 0.45, color, 1, cv2.LINE_AA
        )

    @staticmethod
    def draw_virtual_bat(frame, bat_data: dict | None, color: tuple, label: str):
        if not bat_data:
            return

        bat_start = bat_data["bat_start"]
        bat_end = bat_data["bat_end"]

        cv2.line(frame, bat_start, bat_end, color, 8, cv2.LINE_AA)
        cv2.circle(frame, bat_start, 8, color, -1)
        cv2.circle(frame, bat_end, 10, (255, 255, 255), 2)
        cv2.putText(
            frame,
            label,
            (bat_end[0] + 12, bat_end[1] - 10),
            DebugOverlay.FONT,
            0.5,
            color,
            1,
            cv2.LINE_AA,
        )

    @staticmethod
    def draw_hud(
        frame,
        right_pos, right_data: dict,
        left_pos,  left_data: dict,
        fps: float,
        latest_swing_event: dict | None = None,
        right_bat: dict | None = None,
        left_bat: dict | None = None,
    ):
        """
        Draw the full debug HUD panel in the top-left corner.

        Layout (y positions):
          30  — Right wrist coordinates
          60  — Left wrist coordinates
          100 — Right velocity + direction
          130 — Left velocity + direction
          160 — Right swing sector
          185 — Left swing sector
          210 — Right batting zone
          235 — Left batting zone
          270 — Swing state / cooldown
          305 — Latest swing event
          355 — Shot family
          390 — FPS
        """
        h, w = frame.shape[:2]

        # ── Semi-transparent HUD background ──────────────────────────
        overlay = frame.copy()
        cv2.rectangle(overlay, (5, 5), (600, 450), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

        def put(text, y, color=DebugOverlay.COLOR_WHITE, scale=0.62, thickness=1):
            cv2.putText(
                frame, text, (12, y),
                DebugOverlay.FONT, scale, color, thickness, cv2.LINE_AA
            )

        # Wrist coordinates
        if right_pos:
            put(f"R Wrist : ({right_pos[0]}, {right_pos[1]})", 30,
                color=(80, 80, 255))
        else:
            put("R Wrist : not visible", 30, color=(120, 120, 120))

        if left_pos:
            put(f"L Wrist : ({left_pos[0]}, {left_pos[1]})", 60,
                color=(255, 160, 80))
        else:
            put("L Wrist : not visible", 60, color=(120, 120, 120))

        # Velocity + direction
        rv = right_data["smoothed_velocity"]
        lv = left_data["smoothed_velocity"]
        put(f"R Vel   : {rv:5.1f} px/f  Dir: {right_data['direction']} Ang: {right_data['angle']:.1f}", 100,
            color=DebugOverlay.COLOR_GREEN)
        put(f"L Vel   : {lv:5.1f} px/f  Dir: {left_data['direction']} Ang:{left_data['angle']:.1f}", 130,
            color=DebugOverlay.COLOR_CYAN)
        put(f"R Sector: {right_data['sector']}", 160,
            color=DebugOverlay.COLOR_GREEN, scale=0.55)
        put(f"L Sector: {left_data['sector']}", 185,
            color=DebugOverlay.COLOR_CYAN, scale=0.55)
        put(f"R Zone  : {right_data['zone']}", 210,
            color=DebugOverlay.COLOR_GREEN, scale=0.55)
        put(f"L Zone  : {left_data['zone']}", 235,
            color=DebugOverlay.COLOR_CYAN, scale=0.55)

        if right_bat:
            put(
                f"R Bat   : {right_bat['bat_angle']:5.1f} deg  Len:{right_bat['bat_length']:5.1f}",
                270,
                color=DebugOverlay.COLOR_GREEN,
                scale=0.5,
            )
        else:
            put("R Bat   : not visible", 270, color=(120, 120, 120), scale=0.5)

        if left_bat:
            put(
                f"L Bat   : {left_bat['bat_angle']:5.1f} deg  Len:{left_bat['bat_length']:5.1f}",
                295,
                color=DebugOverlay.COLOR_CYAN,
                scale=0.5,
            )
        else:
            put("L Bat   : not visible", 295, color=(120, 120, 120), scale=0.5)

        # Swing detection state
        r_swing = right_data["swing_detected"]
        l_swing = left_data["swing_detected"]
        r_cd    = right_data["in_cooldown"]
        l_cd    = left_data["in_cooldown"]

        swing_text  = "SWING: "
        swing_text += "R!" if r_swing else ("R-cd" if r_cd else "R-")
        swing_text += "  "
        swing_text += "L!" if l_swing else ("L-cd" if l_cd else "L-")
        swing_color = DebugOverlay.COLOR_RED if (r_swing or l_swing) \
                      else DebugOverlay.COLOR_ORANGE if (r_cd or l_cd) \
                      else DebugOverlay.COLOR_WHITE
        put(swing_text, 320, color=swing_color, scale=0.68, thickness=2)

        if latest_swing_event:
            put(
                "Event   : "
                f"{latest_swing_event['wrist']} "
                f"{latest_swing_event['sector']} "
                f"{latest_swing_event['zone']}",
                355,
                color=DebugOverlay.COLOR_WHITE,
                scale=0.5,
            )
            put(
                "          "
                f"Vel:{latest_swing_event['velocity']:.1f} "
                f"Peak:{latest_swing_event['peak_velocity']:.1f} "
                f"Dur:{latest_swing_event['duration_frames']}",
                380,
                color=DebugOverlay.COLOR_WHITE,
                scale=0.5,
            )
            put(
                f"Shot    : {latest_swing_event['shot_type']}",
                405,
                color=DebugOverlay.COLOR_YELLOW,
                scale=0.55,
            )
        else:
            put("Event   : none", 355, color=(120, 120, 120), scale=0.5)
            put("Shot    : UNKNOWN", 405, color=(120, 120, 120), scale=0.55)

        # FPS
        fps_color = DebugOverlay.COLOR_GREEN if fps >= 25 \
                    else DebugOverlay.COLOR_YELLOW if fps >= 15 \
                    else DebugOverlay.COLOR_RED
        put(f"FPS     : {fps:5.1f}", 440, color=fps_color)

    @staticmethod
    def draw_swing_banner(frame, direction: str, wrist_label: str):
        """
        Large centred banner shown for one cooldown window when a swing fires.
        Drawn over the frame so it's unmissable.
        """
        h, w = frame.shape[:2]
        text = f"{wrist_label.upper()} SWING  {direction}"
        (tw, th), _ = cv2.getTextSize(text, DebugOverlay.FONT, 1.1, 3)
        tx = (w - tw) // 2
        ty = h // 2

        # Drop-shadow effect
        cv2.putText(frame, text, (tx + 2, ty + 2),
                    DebugOverlay.FONT, 1.1, (0, 0, 0), 4, cv2.LINE_AA)
        cv2.putText(frame, text, (tx, ty),
                    DebugOverlay.FONT, 1.1, (0, 0, 255), 3, cv2.LINE_AA)


# ─────────────────────────────────────────────
# FPS TRACKER
# Simple token-bucket FPS estimator.
# Uses wall-clock time, not frame count.
# ─────────────────────────────────────────────
class FPSTracker:
    def __init__(self, smoothing: int = 30):
        self._times: deque[float] = deque(maxlen=smoothing)

    def tick(self) -> float:
        """Call once per frame. Returns current smoothed FPS."""
        self._times.append(time.monotonic())
        if len(self._times) < 2:
            return 0.0
        elapsed = self._times[-1] - self._times[0]
        return (len(self._times) - 1) / elapsed if elapsed > 0 else 0.0


# ─────────────────────────────────────────────
# MAIN LOOP
# Thin orchestration: capture → process → render.
# Each concern is delegated to its own class.
# ─────────────────────────────────────────────
def main():
    cap = cv2.VideoCapture(CONFIG["camera_index"])

    if not cap.isOpened():
        print("[ERROR] Cannot open webcam. Check CONFIG['camera_index'].")
        return

    # Set a reasonable capture resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    # Per-wrist trackers
    right_tracker = WristTracker("Right", color=(80, 80, 255))   # blue-ish
    left_tracker  = WristTracker("Left",  color=(80, 200, 80))   # green-ish

    right_trail = TrajectoryTracker(max_length=25)
    left_trail  = TrajectoryTracker(max_length=25)
    ball = Ball()


    fps_tracker = FPSTracker()
    latest_swing_event = None

    print("[INFO] Cricket Motion Tracker started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to grab frame — skipping.")
            continue

        # Mirror so the display feels natural (selfie view)
        frame = cv2.flip(frame, 1)

        h, w, _ = frame.shape
        ball.update(w, h)

        # ── Pose inference ────────────────────────────────────────────
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results   = pose.process(rgb_frame)

        # Defaults when no landmarks detected
        right_pos, left_pos = None, None
        right_bat, left_bat = None, None

        right_data = {
             "smoothed_velocity": 0.0,
             "direction": "None",
             "angle": 0.0,
             "sector": "NONE",
             "zone": "UNKNOWN",
             "swing_detected": False,
             "swing_window_completed": False,
             "swing_window": None,
             "in_cooldown": False
        }
        left_data=dict(right_data)
        if results.pose_landmarks:
            # Draw pose skeleton
            mp_draw.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                mp_draw.DrawingSpec(color=(200, 200, 200), thickness=1),
                mp_draw.DrawingSpec(color=(100, 100, 255), thickness=2),
            )

            right_trail.draw(frame, color=(0, 255, 255))
            left_trail.draw(frame, color=(255, 255, 0))

            lms = results.pose_landmarks

            # ── Extract wrist positions ───────────────────────────────
            right_pos = MotionAnalyzer.extract_wrist_px(
                lms, mp_pose.PoseLandmark.RIGHT_WRIST, w, h
            )
            left_pos = MotionAnalyzer.extract_wrist_px(
                lms, mp_pose.PoseLandmark.LEFT_WRIST, w, h
            )

            right_bat = VirtualBat.from_pose_landmarks(
                lms,
                mp_pose.PoseLandmark.RIGHT_ELBOW,
                mp_pose.PoseLandmark.RIGHT_WRIST,
                w,
                h,
            )
            left_bat = VirtualBat.from_pose_landmarks(
                lms,
                mp_pose.PoseLandmark.LEFT_ELBOW,
                mp_pose.PoseLandmark.LEFT_WRIST,
                w,
                h,
            )

            DebugOverlay.draw_virtual_bat(
                frame, right_bat, color=(0, 80, 255), label="R Bat"
            )
            DebugOverlay.draw_virtual_bat(
                frame, left_bat, color=(255, 180, 0), label="L Bat"
            )

            if right_pos:
             right_trail.add_point(right_pos)

            if left_pos:
              left_trail.add_point(left_pos)

            # ── Update trackers ───────────────────────────────────────
            if right_pos:
                right_data = right_tracker.update(right_pos)
                right_data["zone"] = BattingZoneClassifier.classify(
                    right_pos[0], right_pos[1], w, h
                )
                DebugOverlay.draw_wrist_marker(
                    frame, right_pos, right_tracker.color,
                    f"R ({right_pos[0]},{right_pos[1]})"
                )

            if left_pos:
                left_data = left_tracker.update(left_pos)
                left_data["zone"] = BattingZoneClassifier.classify(
                    left_pos[0], left_pos[1], w, h
                )
                DebugOverlay.draw_wrist_marker(
                    frame, left_pos, left_tracker.color,
                    f"L ({left_pos[0]},{left_pos[1]})"
                )

            if (
                right_data["swing_window_completed"]
                and latest_swing_event
                and latest_swing_event["wrist"] == "Right"
            ):
                latest_swing_event.update(right_data["swing_window"])
                latest_swing_event["position"] = latest_swing_event["end_position"]
                latest_swing_event["shot_type"] = ShotClassifier.classify(
                    latest_swing_event
                )
            elif (
                left_data["swing_window_completed"]
                and latest_swing_event
                and latest_swing_event["wrist"] == "Left"
            ):
                latest_swing_event.update(left_data["swing_window"])
                latest_swing_event["position"] = latest_swing_event["end_position"]
                latest_swing_event["shot_type"] = ShotClassifier.classify(
                    latest_swing_event
                )

            # ── Swing banners (centre-screen) ─────────────────────────
            if right_data["swing_detected"]:
                latest_swing_event = SwingEvent.create(
                    "Right",
                    right_data,
                    right_pos,
                    time.monotonic(),
                )
                latest_swing_event["shot_type"] = ShotClassifier.classify(
                    latest_swing_event
                )
                DebugOverlay.draw_swing_banner(
                    frame, right_data["direction"], "Right"
                )
            elif left_data["swing_detected"]:
                latest_swing_event = SwingEvent.create(
                    "Left",
                    left_data,
                    left_pos,
                    time.monotonic(),
                )
                latest_swing_event["shot_type"] = ShotClassifier.classify(
                    latest_swing_event
                )
                DebugOverlay.draw_swing_banner(
                    frame, left_data["direction"], "Left"
                )

        # ── HUD overlay (always drawn, even with no skeleton) ─────────
        fps = fps_tracker.tick()
        ball.draw(frame)
        DebugOverlay.draw_hud(
            frame,
            right_pos, right_data,
            left_pos,  left_data,
            fps,
            latest_swing_event,
            right_bat,
            left_bat,
        )

        cv2.imshow("Cricket Motion Tracker — Phase 1/2", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Tracker stopped.")


if __name__ == "__main__":
    main()
