from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    SECRET_KEY: str = "signal-clone-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Twilio — set these as environment variables
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None   # e.g. "+15551234567"

    # OTP config
    OTP_EXPIRE_MINUTES: int = 10
    # Fallback mock OTP when Twilio is not configured (dev/demo mode)
    MOCK_OTP: str = "123456"

    class Config:
        env_file = ".env"


settings = Settings()
