class MotionAnalyzer:
    """
    Stateless helper methods for interpreting wrist motion.

    This module stays independent from the webcam loop, rendering layer, and
    main.py config so future gesture and shot rules can grow here without
    creating circular imports.
    """

    @staticmethod
    def get_direction(
        dx: int,
        dy: int,
        magnitude: float,
        magnitude_threshold: float = 8,
    ) -> str:
        """
        Map a displacement vector to a human-readable cardinal direction.

        Coordinate system (screen space):
          +X -> right    -X -> left
          +Y -> down     -Y -> up   (screen Y is inverted vs. math Y)

        Returns "None" if the movement is below the noise threshold.
        """
        if magnitude < magnitude_threshold:
            return "None"

        if abs(dx) >= abs(dy):
            return "Right →" if dx > 0 else "Left ←"

        return "Down ↓" if dy > 0 else "Up ↑"

    @staticmethod
    def extract_wrist_px(
        landmarks,
        landmark_enum,
        frame_w: int,
        frame_h: int,
    ) -> tuple[int, int] | None:
        """
        Convert a normalized MediaPipe landmark to pixel coordinates.

        Returns None if visibility is low (landmark occluded / off-screen).
        """
        lm = landmarks.landmark[landmark_enum]

        if lm.visibility < 0.4:
            return None

        return (int(lm.x * frame_w), int(lm.y * frame_h))
