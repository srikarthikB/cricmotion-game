import math


class VirtualBat:
    """
    Lightweight virtual bat representation.

    Version 1 treats the player's forearm as the bat:
      bat_start = elbow
      bat_end   = wrist
    """

    MIN_VISIBILITY = 0.4

    @staticmethod
    def _landmark_to_px(landmarks, landmark_enum, frame_w: int, frame_h: int):
        lm = landmarks.landmark[landmark_enum]

        if lm.visibility < VirtualBat.MIN_VISIBILITY:
            return None

        return (int(lm.x * frame_w), int(lm.y * frame_h))

    @staticmethod
    def from_pose_landmarks(
        landmarks,
        elbow_landmark,
        wrist_landmark,
        frame_w: int,
        frame_h: int,
    ) -> dict | None:
        bat_start = VirtualBat._landmark_to_px(
            landmarks, elbow_landmark, frame_w, frame_h
        )
        bat_end = VirtualBat._landmark_to_px(
            landmarks, wrist_landmark, frame_w, frame_h
        )

        if bat_start is None or bat_end is None:
            return None

        dx = bat_end[0] - bat_start[0]
        dy = bat_end[1] - bat_start[1]
        bat_length = math.hypot(dx, dy)
        bat_angle = math.degrees(math.atan2(dy, dx))

        if bat_angle < 0:
            bat_angle += 360

        return {
            "bat_start": bat_start,
            "bat_end": bat_end,
            "bat_angle": bat_angle,
            "bat_length": bat_length,
        }
