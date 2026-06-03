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
import time
from tracking.trajectory_tracker import TrajectoryTracker
from tracking.wrist_tracker import WristTracker
from detectors.gesture_detector import MotionAnalyzer
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
