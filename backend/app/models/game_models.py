from enum import Enum

from pydantic import BaseModel, Field


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class ShotName(str, Enum):
    cover_drive = "cover_drive"
    straight_drive = "straight_drive"
    pull_shot = "pull_shot"
    cut_shot = "cut_shot"
    sweep = "sweep"
    defense = "defense"
    lofted_shot = "lofted_shot"
    unknown = "unknown"


class Timing(str, Enum):
    perfect = "perfect"
    good = "good"
    late = "late"
    early = "early"
    miss = "miss"


class GameStatus(str, Enum):
    running = "running"
    paused = "paused"
    ended = "ended"


class PoseLandmark(BaseModel):
    x: float
    y: float
    z: float


class StartGameRequest(BaseModel):
    player_name: str = Field(..., min_length=1)
    difficulty: Difficulty = Difficulty.medium


class PredictShotRequest(BaseModel):
    game_id: str
    pose: list[PoseLandmark]


class BallResultRequest(BaseModel):
    game_id: str
    shot: ShotName
    timing: Timing


class GameActionRequest(BaseModel):
    game_id: str


class GameState(BaseModel):
    game_id: str
    player_name: str
    difficulty: Difficulty
    target: int
    total_balls: int
    score: int = 0
    wickets: int = 0
    balls_played: int = 0
    status: GameStatus = GameStatus.running