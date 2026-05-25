from fastapi import FastAPI

from app.routes.game_routes import router

app = FastAPI(title="Cricket Motion Game API")

app.include_router(router)