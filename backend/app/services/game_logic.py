from random import choice, random

from fastapi import HTTPException

from app.models.game_models import (
    Difficulty,
    GameState,
    GameStatus,
    ShotName,
    Timing,
)


# --- In-memory data stores ---

games: dict[str, GameState] = {}
leaderboard: list[dict[str, int | str]] = []


# --- Configuration mappings ---

DIFFICULTY_SETTINGS = {
    Difficulty.easy: {"target": 80, "overs": 5},
    Difficulty.medium: {"target": 120, "overs": 5},
    Difficulty.hard: {"target": 160, "overs": 5},
}

SHOT_COMMENTARY = {
    ShotName.cover_drive: "Elegant cover drive through the gap!",
    ShotName.straight_drive: "Crisp straight drive past the bowler!",
    ShotName.pull_shot: "Massive six over deep midwicket!",
    ShotName.cut_shot: "Cut away sharply behind point!",
    ShotName.sweep: "Swept fine for useful runs!",
    ShotName.defense: "Solid defense, no risk taken.",
    ShotName.lofted_shot: "Lofted cleanly over the infield!",
    ShotName.unknown: "Mistimed movement, the batter could not connect.",
}


# --- Helper functions ---

def get_game(game_id: str) -> GameState:
    game = games.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


def ensure_running(game: GameState) -> None:
    if game.status == GameStatus.paused:
        raise HTTPException(status_code=400, detail="Game is paused")
    if game.status == GameStatus.ended:
        raise HTTPException(status_code=400, detail="Game has ended")


def balls_to_overs(balls: int) -> float:
    completed_overs = balls // 6
    balls_in_current_over = balls % 6
    return float(f"{completed_overs}.{balls_in_current_over}")


def calculate_runs(shot: ShotName, timing: Timing) -> tuple[int, bool]:
    if timing == Timing.miss:
        return 0, random() < 0.25

    if shot == ShotName.unknown:
        return 0, random() < 0.20

    timing_runs = {
        Timing.perfect: [4, 6],
        Timing.good: [1, 2, 3, 4],
        Timing.late: [0, 1, 2],
        Timing.early: [0, 1, 2],
        Timing.miss: [0],
    }

    shot_bonus = {
        ShotName.pull_shot: 1,
        ShotName.lofted_shot: 1,
        ShotName.defense: -1,
    }.get(shot, 0)

    runs = max(0, choice(timing_runs[timing]) + shot_bonus)
    wicket_chance = {
        Timing.perfect: 0.02,
        Timing.good: 0.05,
        Timing.late: 0.12,
        Timing.early: 0.12,
        Timing.miss: 0.25,
    }[timing]

    return runs, random() < wicket_chance


def finish_game_if_needed(game: GameState) -> None:
    if game.score >= game.target or game.wickets >= 10 or game.balls_played >= game.total_balls:
        game.status = GameStatus.ended
        leaderboard.append({"player": game.player_name, "score": game.score})
        leaderboard.sort(key=lambda item: int(item["score"]), reverse=True)