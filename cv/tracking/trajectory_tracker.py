from collections import deque
import cv2
import numpy as np


class TrajectoryTracker:

    def __init__(self, max_length=25):
        self.points = deque(maxlen=max_length)

    def add_point(self, point):
        """
        Store new wrist position.
        """
        if point is not None:
            self.points.append(point)

    def clear(self):
        """
        Clear trajectory history.
        """
        self.points.clear()

    def draw(self, frame, color=(0, 255, 255)):
        """
        Draw motion trail.
        """

        if len(self.points) < 2:
            return

        for i in range(1, len(self.points)):

            thickness = int(
                np.interp(
                    i,
                    [1, len(self.points)],
                    [1, 6]
                )
            )

            cv2.line(
                frame,
                self.points[i - 1],
                self.points[i],
                color,
                thickness
            )