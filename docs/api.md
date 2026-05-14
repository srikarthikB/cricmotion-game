# Cricket Motion Game API Documentation

## Base URL

```txt
http://localhost:8000
```

---

# Game Flow

1. Start Game
2. Detect Pose
3. Predict Shot
4. Calculate Runs
5. Update Score
6. Display Match State
7. End Game

---

# Standard Shot Names

These names MUST remain consistent across frontend, backend, and CV modules.

```txt
cover_drive
straight_drive
pull_shot
cut_shot
sweep
defense
lofted_shot
unknown
```

---

# Standard Timing Values

```txt
perfect
good
late
early
miss
```

---

# 1. Health Check

## Endpoint

```txt
GET /health
```

## Purpose

Checks whether backend server is running.

## Response

```json
{
  "status": "running"
}
```

---

# 2. Start Game

## Endpoint

```txt
POST /start-game
```

## Purpose

Starts a new cricket game session.

## Request Body

```json
{
  "player_name": "Karthik",
  "difficulty": "medium"
}
```

## Difficulty Options

```txt
easy
medium
hard
```

## Response

```json
{
  "game_id": "abc123",
  "message": "Game started",
  "target": 120,
  "overs": 5
}
```

---

# 3. Predict Shot

## Endpoint

```txt
POST /predict-shot
```

## Purpose

Receives pose landmarks from CV module and predicts cricket shot.

## Request Body

```json
{
  "game_id": "abc123",
  "pose": [
    {
      "x": 0.52,
      "y": 0.31,
      "z": -0.12
    }
  ]
}
```

## Response

```json
{
  "shot": "cover_drive",
  "confidence": 0.91,
  "timing": "perfect"
}
```

---

# 4. Ball Result

## Endpoint

```txt
POST /ball-result
```

## Purpose

Calculates result of a ball using shot prediction and timing.

## Request Body

```json
{
  "game_id": "abc123",
  "shot": "pull_shot",
  "timing": "perfect"
}
```

## Response

```json
{
  "runs": 6,
  "wicket": false,
  "commentary": "Massive six over deep midwicket!"
}
```

---

# 5. Get Current Score

## Endpoint

```txt
GET /score/{game_id}
```

## Purpose

Returns live score data.

## Example

```txt
GET /score/abc123
```

## Response

```json
{
  "score": 42,
  "wickets": 1,
  "overs": 3.2,
  "balls_left": 10
}
```

---

# 6. Get Match State

## Endpoint

```txt
GET /match-state/{game_id}
```

## Purpose

Returns complete current match information.

## Response

```json
{
  "target": 120,
  "score": 58,
  "wickets": 3,
  "overs": 4.1,
  "balls_left": 5,
  "required_runs": 62
}
```

---

# 7. Pause Game

## Endpoint

```txt
POST /pause-game
```

## Request Body

```json
{
  "game_id": "abc123"
}
```

## Response

```json
{
  "message": "Game paused"
}
```

---

# 8. Resume Game

## Endpoint

```txt
POST /resume-game
```

## Request Body

```json
{
  "game_id": "abc123"
}
```

## Response

```json
{
  "message": "Game resumed"
}
```

---

# 9. End Game

## Endpoint

```txt
POST /end-game
```

## Purpose

Ends the current match.

## Request Body

```json
{
  "game_id": "abc123"
}
```

## Response

```json
{
  "final_score": 86,
  "wickets": 2,
  "result": "won"
}
```

---

# 10. Leaderboard (Optional)

## Endpoint

```txt
GET /leaderboard
```

## Response

```json
[
  {
    "player": "Karthik",
    "score": 120
  },
  {
    "player": "Chandu",
    "score": 98
  }
]
```

---

# Frontend Responsibilities

Frontend should:
- display score
- display commentary
- show webcam feed
- show animations
- call backend APIs
- render game UI

---

# Backend Responsibilities

Backend should:
- manage game state
- calculate score
- handle API routes
- process shot predictions
- return match data

---

# CV Responsibilities

CV module should:
- capture webcam feed
- detect body pose
- send pose landmarks
- identify batting movement

---

# Assets Responsibilities

Assets/testing team should:
- create sound effects
- gather cricket assets
- test gameplay
- test frontend/backend integration

---

# Folder Responsibilities

```txt
frontend/ -> React frontend
backend/ -> FastAPI backend
cv/ -> OpenCV + MediaPipe
assets/ -> sounds/images/videos
docs/ -> documentation
```

---

# Updated Project Structure

```txt
cricket-ai-game/
│
├── cv/
│   ├── webcam.py
│   ├── pose_tracking.py
│   ├── gesture_detection.py
│   └── bat_tracking.py
│
├── backend/
│   ├── main.py
│   ├── routes/
│   ├── services/
│   │   ├── game_logic.py
│   │   ├── scoring.py
│   │   ├── difficulty.py
│   │   └── prediction_handler.py
│   ├── models/
│   └── utils/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── animations/
│   │   ├── scoreboard/
│   │   ├── stadium/
│   │   └── effects/
│   └── public/
│
├── assets/
│   ├── sounds/
│   ├── images/
│   └── music/
│
├── docs/
│   ├── api.md
│   ├── setup.md
│   └── team-roles.md
│
├── .gitignore
├── README.md
└── requirements.txt
```

---

# Backend File Responsibilities

## backend/main.py

Main FastAPI entry point.

Responsibilities:
- start server
- register routes
- initialize application

---

## backend/routes/

Contains API endpoints.

Example future files:

```txt
game_routes.py
score_routes.py
prediction_routes.py
```

Responsibilities:
- define API routes
- receive frontend requests
- return responses

---

## backend/services/

Contains core game logic.

### game_logic.py

Handles:
- innings flow
- wickets
- overs
- match state

### scoring.py

Handles:
- runs
- boundaries
- strike rate
- score calculations

### difficulty.py

Handles:
- easy/medium/hard adjustments
- probability tuning

### prediction_handler.py

Handles:
- communication with CV module
- shot interpretation
- prediction processing

---

## backend/models/

Contains request/response models.

Example:
- Pydantic schemas
- validation models

---

## backend/utils/

Contains helper functions.

Example:
- math helpers
- reusable utilities
- constants

---

# CV Module Responsibilities

## cv/webcam.py

Handles:
- webcam access
- frame capture

---

## cv/pose_tracking.py

Handles:
- MediaPipe pose detection
- body landmark extraction

---

## cv/gesture_detection.py

Handles:
- shot recognition logic
- pose interpretation

---

## cv/bat_tracking.py

Handles:
- optional bat movement tracking
- swing analysis

---

# Frontend Structure Responsibilities

## frontend/src/components/

Reusable UI components.

Example:
- buttons
- cards
- score widgets

---

## frontend/src/animations/

Contains:
- batting animations
- transitions
- visual effects

---

## frontend/src/scoreboard/

Contains:
- live score UI
- wickets display
- overs display

---

## frontend/src/stadium/

Contains:
- stadium visuals
- audience effects
- environment rendering

---

## frontend/src/effects/

Contains:
- hit effects
- particle effects
- celebration effects

---

# Communication Between Modules

## CV → Backend

CV module sends:
- pose landmarks
- shot predictions

Backend processes:
- timing
- scoring
- match logic

---

## Backend → Frontend

Backend sends:
- score updates
- commentary
- match state
- prediction results

Frontend displays:
- gameplay visuals
- scoreboards
- animations

---

# Git Workflow

## Before Starting Work

```bash
git pull origin main
```

---

## Switch To Team Branch

```bash
git checkout frontend-dev
```

Example branches:

```txt
frontend-dev
backend-dev
cv-dev
assets-dev
```

---

## Save Work

```bash
git add .
git commit -m "added feature"
git push origin frontend-dev
```

---

# Pull Request Workflow

1. Push branch changes
2. Open GitHub repository
3. Click "Compare & pull request"
4. Create pull request
5. Admin reviews code
6. Merge into main branch

---

# Important Rules

- Never push directly to main branch
- Keep commits small and meaningful
- Update api.md if APIs change
- Pull latest changes before starting work
- Communicate before editing shared files

---

# Shared Important Files

Avoid multiple teams editing these simultaneously:

```txt
package.json
vite.config.js
main.py
App.jsx
```

---

# Initial Development Priority

## Phase 1

### Frontend
- basic UI
- scoreboard
- pages

### Backend
- FastAPI setup
- `/health`
- `/start-game`

### CV
- webcam setup
- pose detection

---

## Phase 2

- shot prediction
- score system
- frontend/backend connection

---

## Phase 3

- full integration
- animations
- sounds
- gameplay polish

---

# Setup Instructions

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Backend / CV

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

---

# Main Goal

Current goal:

```txt
Build a working playable prototype first.
```

Not:
- perfect AI
- advanced multiplayer
- production-level scalability

Focus on:
- smooth gameplay
- clean integration
- stable APIs
- working shot detection