class SwingSectorClassifier:
    """
    Lightweight rule-based swing sector classifier.

    Converts raw wrist motion angle into stable gameplay-friendly sectors.
    This is intentionally simple so it can act as a low-latency bridge between
    motion tracking and future cricket shot classification.
    """

    MIN_CLASSIFICATION_MAGNITUDE = 8

    @staticmethod
    def classify(angle: float, magnitude: float) -> str:
        """
        Classify wrist motion into a coarse swing sector.

        Angle convention follows the existing atan2(dy, dx) pipeline:
          0/360 = right, 90 = down, 180 = left, 270 = up.
        """
        if magnitude < SwingSectorClassifier.MIN_CLASSIFICATION_MAGNITUDE:
            return "NONE"

        angle = angle % 360

        if 337.5 <= angle or angle < 22.5:
            return "HORIZONTAL_RIGHT"
        if 22.5 <= angle < 67.5:
            return "DIAGONAL_DOWN_RIGHT"
        if 67.5 <= angle < 112.5:
            return "DOWNWARD"
        if 112.5 <= angle < 157.5:
            return "DIAGONAL_DOWN_LEFT"
        if 157.5 <= angle < 202.5:
            return "HORIZONTAL_LEFT"
        if 202.5 <= angle < 247.5:
            return "DIAGONAL_UP_LEFT"
        if 247.5 <= angle < 292.5:
            return "UPWARD"
        if 292.5 <= angle < 337.5:
            return "DIAGONAL_UP_RIGHT"

        return "UNKNOWN"
