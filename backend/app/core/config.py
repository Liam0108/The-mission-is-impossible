from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fabio Edge Research Lab"
    database_url: str = Field(
        default="postgresql+psycopg://fabio:fabio_dev_password@localhost:5432/fabio_edge?connect_timeout=3",
        alias="DATABASE_URL",
    )
    backend_cors_origins: str = Field(default="http://localhost:3000", alias="BACKEND_CORS_ORIGINS")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
