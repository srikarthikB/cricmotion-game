"""
Cricket Motion Tracking System â€” Phase 1/2 Prototype
=====================================================
Real-time wrist tracking and rule-based swing detection using
MediaPipe Pose + OpenCV.

Architecture:
  - CONFIG          : all tuneable parameters in one place
  - WristTracker    : per-wrist state (position history, cooldown)
  - MotionAnalyzer  : stateless motion math (velocity, direction, magnitude)
  - DebugOverlay    : all HUD rendering isolated from logic
  - main()          : thin orchestration loop â€” reads, processes, displays

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
from utils.fps_tracker import FPSTracker
from rendering.debug_overlay import DebugOverlay

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CONFIGURATION
# All thresholds in one dict â€” easy to tune or
# later load from a JSON/YAML settings file.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MEDIAPIPE SETUP
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# WRIST TRACKER
# Holds per-wrist state so both wrists are
# tracked independently without code duplication.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # Average velocity over the window â€” kills single-frame spikes
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

            # â”€â”€ Swing detection with cooldown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if self.cooldown > 0:
                self.cooldown -= 1          # burn down cooldown each frame
            else:
                if smoothed_velocity > CONFIG["swing_velocity_threshold"]:
                    motion_data["swing_detected"] = True
                    self.last_swing_dir = direction
                    self.cooldown = CONFIG["swing_cooldown_frames"]

        self.prev_pos = current_pos
        return motion_data


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DEBUG OVERLAY
# All cv2.putText / cv2.circle rendering lives
# here â€” completely separate from detection logic.
# Comment out draw_hud() call to get a clean feed.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            print("[WARNING] Failed to grab frame â€” skipping.")
            continue

        # Mirror so the display feels natural (selfie view)
        frame = cv2.flip(frame, 1)

        h, w, _ = frame.shape
        ball.update(w, h)

        # â”€â”€ Pose inference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ Extract wrist positions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ Update trackers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ Swing banners (centre-screen) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        # â”€â”€ HUD overlay (always drawn, even with no skeleton) â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        cv2.imshow("Cricket Motion Tracker â€” Phase 1/2", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Tracker stopped.")


if __name__ == "__main__":
    main()
