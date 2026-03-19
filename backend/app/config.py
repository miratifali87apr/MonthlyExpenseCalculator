from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://finance_user:finance_pass@localhost:5432/finance_tracker"
    secret_key: str = "super-secret-key-change-in-production-must-be-32-chars-min"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 1 week
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
