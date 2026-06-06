import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models import Trade

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Trading research and decision-support API. No order placement capabilities are implemented.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    try:
        Base.metadata.create_all(bind=engine)
        app.state.database_startup_error = None
    except SQLAlchemyError as exc:
        app.state.database_startup_error = str(exc)

    @app.get("/health", tags=["health"])
    def root_health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router)
    os.makedirs(settings.upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    return app


app = create_app()
