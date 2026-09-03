import os
from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MatchTrack Online"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "matchtrack_default_secret_key_change_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 Tage

    # Database
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./matchtracker.db")

    # Media & Uploads
    UPLOAD_DIR: str = os.environ.get("UPLOAD_DIR", "uploads")

    # CORS
    BACKEND_CORS_ORIGINS: list = ["*"]

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
