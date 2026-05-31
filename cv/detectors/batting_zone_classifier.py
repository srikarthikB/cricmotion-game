class BattingZoneClassifier:
    """
    Lightweight screen-relative batting zone classifier.

    Divides the camera frame into a simple 3x3 grid. This first version avoids
    body-relative assumptions so it stays fast, stable, and easy to tune before
    future shot classification.
    """

    @staticmethod
    def classify(
        x: int,
        y: int,
        frame_width: int,
        frame_height: int,
    ) -> str:
        """
        Classify a pixel position into a screen-relative batting zone.
        """
        if frame_width <= 0 or frame_height <= 0:
            return "UNKNOWN"

        x = max(0, min(x, frame_width - 1))
        y = max(0, min(y, frame_height - 1))

        col_width = frame_width / 3
        row_height = frame_height / 3

        if y < row_height:
            row = "HIGH"
        elif y < row_height * 2:
            row = "MID"
        else:
            row = "LOW"

        if x < col_width:
            col = "LEFT"
        elif x < col_width * 2:
            col = "CENTER"
        else:
            col = "RIGHT"

        return f"{row}_{col}"
