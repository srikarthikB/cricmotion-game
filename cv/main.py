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

    def update(self, current_pos: tuple[int, int]) -> dict:
        """
        Call once per frame with the current (x, y) pixel position.
        Returns a motion_data dict consumed by MotionAnalyzer and the HUD.
        """
        motion_data = {
            "dx": 0, "dy": 0,
            "magnitude": 0.0,
            "smoothed_velocity": 0.0,
            "direction": "None",
            "swing_detected": False,
            "in_cooldown": self.cooldown > 0,
        }

        if self.prev_pos is not None:
            dx = current_pos[0] - self.prev_pos[0]
            dy = current_pos[1] - self.prev_pos[1]
            magnitude = math.hypot(dx, dy)          # Euclidean distance

            # Append raw speed to rolling window
            self.velocity_history.append(magnitude)

            # Average velocity over the window — kills single-frame spikes
            smoothed_velocity = (
                sum(self.velocity_history) / len(self.velocity_history)
            )

            # Determine cardinal swing direction
            direction = MotionAnalyzer.get_direction(dx, dy, magnitude)

            motion_data.update({
                "dx": dx,
                "dy": dy,
                "magnitude": magnitude,
                "smoothed_velocity": smoothed_velocity,
                "direction": direction,
            })

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
# MOTION ANALYZER
# Pure stateless functions — no instance needed.
# Easy to unit-test in isolation.
# ─────────────────────────────────────────────
class MotionAnalyzer:
    """
    Stateless helper methods for motion math.
    All methods are @staticmethod — no instance needed.
    """

    @staticmethod
    def get_direction(dx: int, dy: int, magnitude: float) -> str:
        """
        Map a displacement vector to a human-readable cardinal direction.

        Coordinate system (screen space):
          +X → right    −X → left
          +Y → down     −Y → up   (screen Y is inverted vs. math Y)

        We pick the dominant axis (whichever |component| is larger)
        to avoid diagonal labels. Diagonal support is a future extension.

        Returns "None" if the movement is below the noise threshold.
        """
        if magnitude < CONFIG["direction_magnitude_threshold"]:
            return "None"

        # Dominant axis determines the label
        if abs(dx) >= abs(dy):
            return "Right →" if dx > 0 else "Left ←"
        else:
            # Screen Y increases downward, so negative dy = moving up
            return "Down ↓" if dy > 0 else "Up ↑"

    @staticmethod
    def extract_wrist_px(
        landmarks, landmark_enum, frame_w: int, frame_h: int
    ) -> tuple[int, int] | None:
        """
        Convert a normalized MediaPipe landmark to pixel coordinates.
        Returns None if visibility is low (landmark occluded / off-screen).
        """
        lm = landmarks.landmark[landmark_enum]

        # Skip landmarks MediaPipe is uncertain about
        if lm.visibility < 0.4:
            return None

        return (int(lm.x * frame_w), int(lm.y * frame_h))


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
    def draw_hud(
        frame,
        right_pos, right_data: dict,
        left_pos,  left_data: dict,
        fps: float,
    ):
        """
        Draw the full debug HUD panel in the top-left corner.

        Layout (y positions):
          30  — Right wrist coordinates
          60  — Left wrist coordinates
          100 — Right velocity + direction
          130 — Left velocity + direction
          170 — Swing state / cooldown
          210 — FPS
        """
        h, w = frame.shape[:2]

        # ── Semi-transparent HUD background ──────────────────────────
        overlay = frame.copy()
        cv2.rectangle(overlay, (5, 5), (400, 230), (0, 0, 0), -1)
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
        put(f"R Vel   : {rv:5.1f} px/f  Dir: {right_data['direction']}", 100,
            color=DebugOverlay.COLOR_GREEN)
        put(f"L Vel   : {lv:5.1f} px/f  Dir: {left_data['direction']}", 130,
            color=DebugOverlay.COLOR_CYAN)

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
        put(swing_text, 170, color=swing_color, scale=0.68, thickness=2)

        # FPS
        fps_color = DebugOverlay.COLOR_GREEN if fps >= 25 \
                    else DebugOverlay.COLOR_YELLOW if fps >= 15 \
                    else DebugOverlay.COLOR_RED
        put(f"FPS     : {fps:5.1f}", 210, color=fps_color)

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

    fps_tracker = FPSTracker()

    print("[INFO] Cricket Motion Tracker started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to grab frame — skipping.")
            continue

        # Mirror so the display feels natural (selfie view)
        frame = cv2.flip(frame, 1)

        h, w, _ = frame.shape

        # ── Pose inference ────────────────────────────────────────────
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results   = pose.process(rgb_frame)

        # Defaults when no landmarks detected
        right_pos, left_pos = None, None
        right_data = {"smoothed_velocity": 0.0, "direction": "None",
                      "swing_detected": False, "in_cooldown": False}
        left_data  = dict(right_data)

        if results.pose_landmarks:
            # Draw pose skeleton
            mp_draw.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                mp_draw.DrawingSpec(color=(200, 200, 200), thickness=1),
                mp_draw.DrawingSpec(color=(100, 100, 255), thickness=2),
            )

            lms = results.pose_landmarks

            # ── Extract wrist positions ───────────────────────────────
            right_pos = MotionAnalyzer.extract_wrist_px(
                lms, mp_pose.PoseLandmark.RIGHT_WRIST, w, h
            )
            left_pos = MotionAnalyzer.extract_wrist_px(
                lms, mp_pose.PoseLandmark.LEFT_WRIST, w, h
            )

            # ── Update trackers ───────────────────────────────────────
            if right_pos:
                right_data = right_tracker.update(right_pos)
                DebugOverlay.draw_wrist_marker(
                    frame, right_pos, right_tracker.color,
                    f"R ({right_pos[0]},{right_pos[1]})"
                )

            if left_pos:
                left_data = left_tracker.update(left_pos)
                DebugOverlay.draw_wrist_marker(
                    frame, left_pos, left_tracker.color,
                    f"L ({left_pos[0]},{left_pos[1]})"
                )

            # ── Swing banners (centre-screen) ─────────────────────────
            if right_data["swing_detected"]:
                DebugOverlay.draw_swing_banner(
                    frame, right_data["direction"], "Right"
                )
            elif left_data["swing_detected"]:
                DebugOverlay.draw_swing_banner(
                    frame, left_data["direction"], "Left"
                )

        # ── HUD overlay (always drawn, even with no skeleton) ─────────
        fps = fps_tracker.tick()
        DebugOverlay.draw_hud(
            frame,
            right_pos, right_data,
            left_pos,  left_data,
            fps,
        )

        cv2.imshow("Cricket Motion Tracker — Phase 1/2", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Tracker stopped.")


if __name__ == "__main__":
    main()