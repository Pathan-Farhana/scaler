from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "signal-clone-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    MOCK_OTP: str = "123456"

    class Config:
        env_file = ".env"


settings = Settings()
