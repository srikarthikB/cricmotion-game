import cv2


class Ball:
    """
    Lightweight virtual ball for gameplay prototyping.

    Version 1 uses simple deterministic motion only. Collision detection,
    scoring, and cricket-specific physics will be layered on later.
    """

    def __init__(
        self,
        x: float = 0.0,
        y: float = 0.0,
        vx: float = 0.0,
        vy: float = 8.0,
        radius: int = 14,
        active: bool = True,
    ):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.radius = radius
        self.active = active

    def reset(self, frame_width: int, frame_height: int):
        """
        Reset the ball to the top-center of the frame.
        """
        self.x = frame_width / 2
        self.y = -self.radius
        self.vx = 0.0
        self.vy = 8.0
        self.active = True

    def update(self, frame_width: int, frame_height: int):
        """
        Move the ball toward the batting area using deterministic motion.
        """
        if frame_width <= 0 or frame_height <= 0:
            self.active = False
            return

        if not self.active:
            self.reset(frame_width, frame_height)

        if self.x == 0.0 and self.y == 0.0:
            self.reset(frame_width, frame_height)

        self.x += self.vx
        self.y += self.vy

        if self.y - self.radius > frame_height:
            self.reset(frame_width, frame_height)

    def draw(self, frame):
        """
        Render the ball on the current frame.
        """
        if not self.active:
            return

        center = (int(self.x), int(self.y))

        cv2.circle(frame, center, self.radius + 3, (255, 255, 255), 2)
        cv2.circle(frame, center, self.radius, (0, 220, 255), -1)
        cv2.circle(
            frame,
            (center[0] - self.radius // 3, center[1] - self.radius // 3),
            max(2, self.radius // 4),
            (255, 255, 255),
            -1,
        )
