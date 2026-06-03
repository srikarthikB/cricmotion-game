import math
from collections import deque

from detectors.gesture_detector import MotionAnalyzer
from detectors.swing_sector_classifier import SwingSectorClassifier


CONFIG = {
    "swing_velocity_threshold": 18,
    "swing_cooldown_frames": 20,
    "velocity_smoothing_window": 5,
    "direction_magnitude_threshold": 8,
}


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

            # Average velocity over the window - kills single-frame spikes
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

            # Swing detection with cooldown
            if self.cooldown > 0:
                self.cooldown -= 1          # burn down cooldown each frame
            else:
                if smoothed_velocity > CONFIG["swing_velocity_threshold"]:
                    motion_data["swing_detected"] = True
                    self.last_swing_dir = direction
                    self.cooldown = CONFIG["swing_cooldown_frames"]

        self.prev_pos = current_pos
        return motion_data
