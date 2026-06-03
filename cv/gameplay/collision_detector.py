import math


class CollisionDetector:
    """
    Lightweight collision checks for gameplay objects.

    Version 1 detects whether the ball circle intersects the virtual bat line
    segment. It does not apply reactions, scoring, or physics.
    """

    BAT_VISUAL_PADDING = 4.0

    @staticmethod
    def _distance_point_to_segment(point, segment_start, segment_end) -> float:
        px, py = point
        ax, ay = segment_start
        bx, by = segment_end

        abx = bx - ax
        aby = by - ay
        apx = px - ax
        apy = py - ay

        ab_length_sq = abx * abx + aby * aby
        if ab_length_sq == 0:
            return math.hypot(px - ax, py - ay)

        t = (apx * abx + apy * aby) / ab_length_sq
        t = max(0.0, min(1.0, t))

        closest_x = ax + t * abx
        closest_y = ay + t * aby

        return math.hypot(px - closest_x, py - closest_y)

    @staticmethod
    def ball_hits_bat(ball, bat_data: dict | None) -> bool:
        if not ball.active or not bat_data:
            return False

        distance = CollisionDetector.distance_to_bat(ball, bat_data)

        return distance <= ball.radius + CollisionDetector.BAT_VISUAL_PADDING

    @staticmethod
    def distance_to_bat(ball, bat_data: dict | None) -> float | None:
        if not ball.active or not bat_data:
            return None

        ball_center = (ball.x, ball.y)
        return CollisionDetector._distance_point_to_segment(
            ball_center,
            bat_data["bat_start"],
            bat_data["bat_end"],
        )

    @staticmethod
    def debug_data(ball, right_bat: dict | None, left_bat: dict | None) -> dict:
        right_distance = CollisionDetector.distance_to_bat(ball, right_bat)
        left_distance = CollisionDetector.distance_to_bat(ball, left_bat)

        nearest_bat = None
        nearest_distance = None

        if right_distance is not None:
            nearest_bat = right_bat
            nearest_distance = right_distance

        if left_distance is not None and (
            nearest_distance is None or left_distance < nearest_distance
        ):
            nearest_bat = left_bat
            nearest_distance = left_distance

        return {
            "ball_position": (ball.x, ball.y),
            "bat_start": nearest_bat["bat_start"] if nearest_bat else None,
            "bat_end": nearest_bat["bat_end"] if nearest_bat else None,
            "distance_to_bat": nearest_distance,
            "hit_tolerance": ball.radius + CollisionDetector.BAT_VISUAL_PADDING,
            "right_bat_visible": right_bat is not None,
            "left_bat_visible": left_bat is not None,
        }

    @staticmethod
    def classify(ball, right_bat: dict | None, left_bat: dict | None) -> str:
        if (
            CollisionDetector.ball_hits_bat(ball, right_bat)
            or CollisionDetector.ball_hits_bat(ball, left_bat)
        ):
            return "HIT"

        return "MISS"
