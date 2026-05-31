class ShotClassifier:
    """
    First-generation rule-based cricket shot family classifier.

    This classifier intentionally returns broad shot families only. It consumes
    the stable SwingEvent signal and can later be extended into more specific
    subtypes without changing the gameplay pipeline.
    """

    DEFENSIVE_MAX_VELOCITY = 24.0
    ATTACKING_MIN_VELOCITY = 22.0
    LOFTED_MIN_VELOCITY = 28.0

    UPWARD_SECTORS = {
        "UPWARD",
        "DIAGONAL_UP_LEFT",
        "DIAGONAL_UP_RIGHT",
    }

    DRIVE_SECTORS = {
        "DOWNWARD",
        "DIAGONAL_DOWN_LEFT",
        "DIAGONAL_DOWN_RIGHT",
    }

    PULL_CUT_SECTORS = {
        "HORIZONTAL_LEFT",
        "HORIZONTAL_RIGHT",
    }

    @staticmethod
    def classify(swing_event: dict) -> str:
        """
        Classify a swing event into a broad shot family.

        Allowed outputs:
          DEFENSIVE, DRIVE, LOFTED, PULL_CUT, UNKNOWN
        """
        if not swing_event:
            return "UNKNOWN"

        sector = swing_event.get("sector", "UNKNOWN")
        zone = swing_event.get("zone", "UNKNOWN")
        velocity = max(
            swing_event.get("velocity", 0.0),
            swing_event.get("peak_velocity", 0.0),
        )
        duration_frames = swing_event.get("duration_frames", 1)

        if sector in {"NONE", "UNKNOWN"} or zone == "UNKNOWN":
            return "UNKNOWN"

        if duration_frames <= 1 and velocity < ShotClassifier.LOFTED_MIN_VELOCITY:
            return "UNKNOWN"

        if velocity <= ShotClassifier.DEFENSIVE_MAX_VELOCITY:
            return "DEFENSIVE"

        if (
            sector in ShotClassifier.UPWARD_SECTORS
            and velocity >= ShotClassifier.LOFTED_MIN_VELOCITY
        ):
            return "LOFTED"

        if (
            sector in ShotClassifier.PULL_CUT_SECTORS
            and velocity >= ShotClassifier.ATTACKING_MIN_VELOCITY
        ):
            return "PULL_CUT"

        if (
            sector in ShotClassifier.DRIVE_SECTORS
            and velocity >= ShotClassifier.ATTACKING_MIN_VELOCITY
        ):
            return "DRIVE"

        if zone.startswith("LOW") and velocity < ShotClassifier.LOFTED_MIN_VELOCITY:
            return "DEFENSIVE"

        return "UNKNOWN"
