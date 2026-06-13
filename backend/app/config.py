import os
import sys

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://finance_user:finance_pass@localhost:5432/finance_tracker"
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 1 week
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

# Fail loudly if SECRET_KEY is unset or still a known default.
_UNSAFE_DEFAULTS = {"", "super-secret-key-change-in-production-must-be-32-chars-min"}
if settings.secret_key in _UNSAFE_DEFAULTS:
    # Allow tests to run without a real secret
    if "pytest" not in sys.modules:
        raise RuntimeError(
            "SECRET_KEY is not set or is using an unsafe default. "
            "Set SECRET_KEY in your .env file (minimum 32 characters)."
        )
