from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, OTPRequest, UserOut
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.services.otp_service import send_otp, verify_otp

router = APIRouter()


@router.post("/send-otp")
async def send_otp_endpoint(req: OTPRequest):
    """
    Send a 6-digit OTP to the given phone number via Twilio SMS.
    Falls back to mock mode (OTP in response + server log) when
    TWILIO_* env vars are not set.
    """
    result = await send_otp(req.phone_number)
    return result


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Verify OTP (real or mock)
    valid = await verify_otp(req.phone_number, req.otp)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    # Check phone already registered
    result = await db.execute(select(User).where(User.phone_number == req.phone_number))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        phone_number=req.phone_number,
        display_name=req.display_name,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone_number == req.phone_number))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
