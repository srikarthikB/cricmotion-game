from random import choice, random
from uuid import uuid4

from fastapi import APIRouter

from app.models.game_models import (
    BallResultRequest,
    GameActionRequest,
    PredictShotRequest,
    ShotName,
    StartGameRequest,
    Timing,
    GameState,
    GameStatus,
)
from app.services.game_logic import (
    DIFFICULTY_SETTINGS,
    SHOT_COMMENTARY,
    balls_to_overs,
    calculate_runs,
    ensure_running,
    finish_game_if_needed,
    games,
    get_game,
    leaderboard,
)

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "running"}


@router.post("/start-game")
def start_game(request: StartGameRequest) -> dict[str, str | int]:
    settings = DIFFICULTY_SETTINGS[request.difficulty]
    game_id = uuid4().hex[:8]
    overs = settings["overs"]

    games[game_id] = GameState(
        game_id=game_id,
        player_name=request.player_name,
        difficulty=request.difficulty,
        target=settings["target"],
        total_balls=overs * 6,
    )

    return {
        "game_id": game_id,
        "message": "Game started",
        "target": settings["target"],
        "overs": overs,
    }


@router.post("/predict-shot")
def predict_shot(request: PredictShotRequest) -> dict[str, str | float]:
    game = get_game(request.game_id)
    ensure_running(game)

    if not request.pose:
        return {"shot": ShotName.unknown, "confidence": 0.0, "timing": Timing.miss}

    # Placeholder model logic. Replace this with the real CV/ML model output later.
    available_shots = [shot for shot in ShotName if shot != ShotName.unknown]
    shot = choice(available_shots)
    confidence = round(0.70 + random() * 0.29, 2)
    timing = choice([Timing.perfect, Timing.good, Timing.late, Timing.early])

    return {"shot": shot, "confidence": confidence, "timing": timing}


@router.post("/ball-result")
def ball_result(request: BallResultRequest) -> dict[str, int | bool | str]:
    game = get_game(request.game_id)
    ensure_running(game)

    runs, wicket = calculate_runs(request.shot, request.timing)
    game.balls_played += 1
    game.score += runs

    if wicket:
        game.wickets += 1

    finish_game_if_needed(game)

    commentary = SHOT_COMMENTARY[request.shot]
    if wicket:
        commentary = f"{commentary} Wicket!"

    return {"runs": runs, "wicket": wicket, "commentary": commentary}


@router.get("/score/{game_id}")
def get_score(game_id: str) -> dict[str, int | float]:
    game = get_game(game_id)
    balls_left = max(game.total_balls - game.balls_played, 0)

    return {
        "score": game.score,
        "wickets": game.wickets,
        "overs": balls_to_overs(game.balls_played),
        "balls_left": balls_left,
    }


@router.get("/match-state/{game_id}")
def get_match_state(game_id: str) -> dict[str, int | float | str]:
    game = get_game(game_id)
    balls_left = max(game.total_balls - game.balls_played, 0)

    runs_needed = max(game.target - game.score, 0)

    return {
        "target": game.target,
        "score": game.score,
        "wickets": game.wickets,
        "overs": balls_to_overs(game.balls_played),
        "balls_left": balls_left,
        "runs_needed": runs_needed,
        "status": game.status,
    }