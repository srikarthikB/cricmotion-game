class SwingEvent:
    """
    Lightweight gameplay signal created only when a swing is detected.

    This is a plain dict factory, not an event bus or framework. Future
    gameplay layers can consume this stable structure for shot classification,
    virtual bat logic, and ball interaction.
    """

    @staticmethod
    def create(
        wrist: str,
        motion_data: dict,
        position: tuple[int, int],
        timestamp: float,
    ) -> dict:
        swing_window = motion_data.get("swing_window") or {}

        return {
            "wrist": wrist,
            "sector": motion_data["sector"],
            "zone": motion_data["zone"],
            "angle": motion_data["angle"],
            "direction": motion_data["direction"],
            "velocity": motion_data["smoothed_velocity"],
            "magnitude": motion_data["magnitude"],
            "position": position,
            "timestamp": timestamp,
            "start_position": swing_window.get("start_position", position),
            "end_position": swing_window.get("end_position", position),
            "peak_velocity": swing_window.get(
                "peak_velocity",
                motion_data["smoothed_velocity"],
            ),
            "duration_frames": swing_window.get("duration_frames", 1),
            "shot_type": "UNKNOWN",
        }
