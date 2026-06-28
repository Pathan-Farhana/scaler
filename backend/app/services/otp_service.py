"""
OTP Service
-----------
• Generates a 6-digit OTP and stores it in memory with a TTL.
• Sends the OTP via Twilio SMS when credentials are configured.
• Falls back to mock mode (prints OTP to console) when Twilio env vars are absent.
"""

import random
import string
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Tuple
from app.config import settings

# ── In-memory store: phone_number -> (otp, expires_at) ──────────────────────
_otp_store: Dict[str, Tuple[str, datetime]] = {}
_store_lock = asyncio.Lock()


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


async def send_otp(phone_number: str) -> dict:
    """
    Generate an OTP, persist it, and dispatch via Twilio (or mock).
    Returns {"mode": "twilio"|"mock", "message": str}
    """
    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    async with _store_lock:
        _otp_store[phone_number] = (otp, expires_at)

    twilio_ready = all([
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_AUTH_TOKEN,
        settings.TWILIO_PHONE_NUMBER,
    ])

    if twilio_ready:
        return await _send_via_twilio(phone_number, otp)
    else:
        return _send_mock(phone_number, otp)


async def verify_otp(phone_number: str, otp: str) -> bool:
    """
    Validate the OTP.  Removes it from the store on success (single-use).
    Also accepts the MOCK_OTP when Twilio is not configured.
    """
    twilio_ready = all([
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_AUTH_TOKEN,
        settings.TWILIO_PHONE_NUMBER,
    ])

    # Allow the mock OTP in demo / dev mode
    if not twilio_ready and otp == settings.MOCK_OTP:
        return True

    async with _store_lock:
        entry = _otp_store.get(phone_number)
        if not entry:
            return False
        stored_otp, expires_at = entry
        if datetime.utcnow() > expires_at:
            del _otp_store[phone_number]
            return False
        if stored_otp != otp:
            return False
        del _otp_store[phone_number]   # single-use
        return True


# ── Twilio sender ─────────────────────────────────────────────────────────────

async def _send_via_twilio(phone_number: str, otp: str) -> dict:
    import asyncio
    from functools import partial

    def _sync_send():
        from twilio.rest import Client  # imported lazily so absence doesn't crash
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=f"Your Signal verification code is: {otp}\nValid for {settings.OTP_EXPIRE_MINUTES} minutes. Do not share it.",
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone_number,
        )
        return message.sid

    loop = asyncio.get_event_loop()
    sid = await loop.run_in_executor(None, _sync_send)
    return {
        "mode": "twilio",
        "message": f"OTP sent to {phone_number}",
        "sid": sid,
    }


# ── Mock sender (dev / demo) ──────────────────────────────────────────────────

def _send_mock(phone_number: str, otp: str) -> dict:
    print(f"\n{'='*50}")
    print(f"[MOCK OTP]  Phone: {phone_number}  →  OTP: {otp}")
    print(f"(Twilio not configured — OTP printed to console)")
    print(f"{'='*50}\n")
    return {
        "mode": "mock",
        "message": f"OTP sent to {phone_number} (mock mode — check server logs)",
        "mock_otp": otp,   # returned in response for demo convenience
    }
