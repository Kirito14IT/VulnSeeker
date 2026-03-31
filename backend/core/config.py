"""
Central configuration for the FastAPI backend.
Reads from environment variables (.env file).
"""

from pathlib import Path
from functools import cached_property, lru_cache
import shutil
import subprocess
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── MySQL Database ───────────────────────────────────────────────
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "vulnseeker"

    # ── JWT Authentication ────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_STRONG_RANDOM_KEY"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── FastAPI ──────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # ── VulnSeeker Engine ─────────────────────────────────────────────
    # Absolute path to the VulnSeeker project root (where src/, output/ live)
    VULNSEEKER_ROOT: Path = Path(__file__).resolve().parents[2]
    ANALYSIS_PYTHON: str | None = None

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Sync URL for use with Alembic migrations."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        )

    @property
    def RESULTS_ROOT(self) -> Path:
        return self.VULNSEEKER_ROOT / "output" / "results"

    @property
    def DATABASES_ROOT(self) -> Path:
        return self.VULNSEEKER_ROOT / "output" / "databases"

    @property
    def WEB_TASKS_ROOT(self) -> Path:
        return self.VULNSEEKER_ROOT / "output" / "web_tasks"

    @property
    def ROOT_ENV_FILE(self) -> Path:
        return self.VULNSEEKER_ROOT / ".env"

    @property
    def ROOT_ENV_EXAMPLE_FILE(self) -> Path:
        return self.VULNSEEKER_ROOT / ".env.example"

    @property
    def BACKEND_ENV_FILE(self) -> Path:
        return self.VULNSEEKER_ROOT / "backend" / ".env"

    @cached_property
    def ANALYSIS_PYTHON_EXECUTABLE(self) -> str:
        if self.ANALYSIS_PYTHON:
            return self.ANALYSIS_PYTHON

        poetry = shutil.which("poetry")
        if poetry:
            try:
                result = subprocess.run(
                    [poetry, "env", "info", "--executable"],
                    cwd=str(self.VULNSEEKER_ROOT),
                    capture_output=True,
                    text=True,
                    check=True,
                )
                poetry_python = result.stdout.strip()
                if poetry_python:
                    return poetry_python
            except Exception:
                pass

        return sys.executable


@lru_cache
def get_settings() -> Settings:
    return Settings()
