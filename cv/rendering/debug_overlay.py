import cv2


class DebugOverlay:
    """
    Renders all debug information onto the frame.
    Keeps cv2 drawing calls out of the logic layer.
    """

    # HUD colour palette
    COLOR_GREEN  = (0, 255, 0)
    COLOR_RED    = (0, 0, 255)
    COLOR_YELLOW = (0, 255, 255)
    COLOR_WHITE  = (255, 255, 255)
    COLOR_ORANGE = (0, 165, 255)
    COLOR_CYAN   = (255, 255, 0)

    FONT = cv2.FONT_HERSHEY_SIMPLEX

    @staticmethod
    def draw_wrist_marker(
        frame, pos: tuple[int, int], color: tuple, label: str
    ):
        """Circle + coordinate label on a wrist landmark."""
        cv2.circle(frame, pos, 12, color, -1)
        cv2.circle(frame, pos, 14, (255, 255, 255), 1)   # white ring
        cv2.putText(
            frame, label, (pos[0] + 16, pos[1] + 6),
            DebugOverlay.FONT, 0.45, color, 1, cv2.LINE_AA
        )

    @staticmethod
    def draw_virtual_bat(frame, bat_data: dict | None, color: tuple, label: str):
        if not bat_data:
            return

        bat_start = bat_data["bat_start"]
        bat_end = bat_data["bat_end"]

        cv2.line(frame, bat_start, bat_end, color, 8, cv2.LINE_AA)
        cv2.circle(frame, bat_start, 8, color, -1)
        cv2.circle(frame, bat_end, 10, (255, 255, 255), 2)
        cv2.putText(
            frame,
            label,
            (bat_end[0] + 12, bat_end[1] - 10),
            DebugOverlay.FONT,
            0.5,
            color,
            1,
            cv2.LINE_AA,
        )

    @staticmethod
    def draw_hud(
        frame,
        right_pos, right_data: dict,
        left_pos,  left_data: dict,
        fps: float,
        latest_swing_event: dict | None = None,
        right_bat: dict | None = None,
        left_bat: dict | None = None,
    ):
        """
        Draw the full debug HUD panel in the top-left corner.

        Layout (y positions):
          30  - Right wrist coordinates
          60  - Left wrist coordinates
          100 - Right velocity + direction
          130 - Left velocity + direction
          160 - Right swing sector
          185 - Left swing sector
          210 - Right batting zone
          235 - Left batting zone
          270 - Swing state / cooldown
          305 - Latest swing event
          355 - Shot family
          390 - FPS
        """
        h, w = frame.shape[:2]

        # Semi-transparent HUD background
        overlay = frame.copy()
        cv2.rectangle(overlay, (5, 5), (600, 450), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

        def put(text, y, color=DebugOverlay.COLOR_WHITE, scale=0.62, thickness=1):
            cv2.putText(
                frame, text, (12, y),
                DebugOverlay.FONT, scale, color, thickness, cv2.LINE_AA
            )

        # Wrist coordinates
        if right_pos:
            put(f"R Wrist : ({right_pos[0]}, {right_pos[1]})", 30,
                color=(80, 80, 255))
        else:
            put("R Wrist : not visible", 30, color=(120, 120, 120))

        if left_pos:
            put(f"L Wrist : ({left_pos[0]}, {left_pos[1]})", 60,
                color=(255, 160, 80))
        else:
            put("L Wrist : not visible", 60, color=(120, 120, 120))

        # Velocity + direction
        rv = right_data["smoothed_velocity"]
        lv = left_data["smoothed_velocity"]
        put(f"R Vel   : {rv:5.1f} px/f  Dir: {right_data['direction']} Ang: {right_data['angle']:.1f}", 100,
            color=DebugOverlay.COLOR_GREEN)
        put(f"L Vel   : {lv:5.1f} px/f  Dir: {left_data['direction']} Ang:{left_data['angle']:.1f}", 130,
            color=DebugOverlay.COLOR_CYAN)
        put(f"R Sector: {right_data['sector']}", 160,
            color=DebugOverlay.COLOR_GREEN, scale=0.55)
        put(f"L Sector: {left_data['sector']}", 185,
            color=DebugOverlay.COLOR_CYAN, scale=0.55)
        put(f"R Zone  : {right_data['zone']}", 210,
            color=DebugOverlay.COLOR_GREEN, scale=0.55)
        put(f"L Zone  : {left_data['zone']}", 235,
            color=DebugOverlay.COLOR_CYAN, scale=0.55)

        if right_bat:
            put(
                f"R Bat   : {right_bat['bat_angle']:5.1f} deg  Len:{right_bat['bat_length']:5.1f}",
                270,
                color=DebugOverlay.COLOR_GREEN,
                scale=0.5,
            )
        else:
            put("R Bat   : not visible", 270, color=(120, 120, 120), scale=0.5)

        if left_bat:
            put(
                f"L Bat   : {left_bat['bat_angle']:5.1f} deg  Len:{left_bat['bat_length']:5.1f}",
                295,
                color=DebugOverlay.COLOR_CYAN,
                scale=0.5,
            )
        else:
            put("L Bat   : not visible", 295, color=(120, 120, 120), scale=0.5)

        # Swing detection state
        r_swing = right_data["swing_detected"]
        l_swing = left_data["swing_detected"]
        r_cd    = right_data["in_cooldown"]
        l_cd    = left_data["in_cooldown"]

        swing_text  = "SWING: "
        swing_text += "R!" if r_swing else ("R-cd" if r_cd else "R-")
        swing_text += "  "
        swing_text += "L!" if l_swing else ("L-cd" if l_cd else "L-")
        swing_color = DebugOverlay.COLOR_RED if (r_swing or l_swing) \
                      else DebugOverlay.COLOR_ORANGE if (r_cd or l_cd) \
                      else DebugOverlay.COLOR_WHITE
        put(swing_text, 320, color=swing_color, scale=0.68, thickness=2)

        if latest_swing_event:
            put(
                "Event   : "
                f"{latest_swing_event['wrist']} "
                f"{latest_swing_event['sector']} "
                f"{latest_swing_event['zone']}",
                355,
                color=DebugOverlay.COLOR_WHITE,
                scale=0.5,
            )
            put(
                "          "
                f"Vel:{latest_swing_event['velocity']:.1f} "
                f"Peak:{latest_swing_event['peak_velocity']:.1f} "
                f"Dur:{latest_swing_event['duration_frames']}",
                380,
                color=DebugOverlay.COLOR_WHITE,
                scale=0.5,
            )
            put(
                f"Shot    : {latest_swing_event['shot_type']}",
                405,
                color=DebugOverlay.COLOR_YELLOW,
                scale=0.55,
            )
        else:
            put("Event   : none", 355, color=(120, 120, 120), scale=0.5)
            put("Shot    : UNKNOWN", 405, color=(120, 120, 120), scale=0.55)

        # FPS
        fps_color = DebugOverlay.COLOR_GREEN if fps >= 25 \
                    else DebugOverlay.COLOR_YELLOW if fps >= 15 \
                    else DebugOverlay.COLOR_RED
        put(f"FPS     : {fps:5.1f}", 440, color=fps_color)

    @staticmethod
    def draw_swing_banner(frame, direction: str, wrist_label: str):
        """
        Large centred banner shown for one cooldown window when a swing fires.
        Drawn over the frame so it's unmissable.
        """
        h, w = frame.shape[:2]
        text = f"{wrist_label.upper()} SWING  {direction}"
        (tw, th), _ = cv2.getTextSize(text, DebugOverlay.FONT, 1.1, 3)
        tx = (w - tw) // 2
        ty = h // 2

        # Drop-shadow effect
        cv2.putText(frame, text, (tx + 2, ty + 2),
                    DebugOverlay.FONT, 1.1, (0, 0, 0), 4, cv2.LINE_AA)
        cv2.putText(frame, text, (tx, ty),
                    DebugOverlay.FONT, 1.1, (0, 0, 255), 3, cv2.LINE_AA)
