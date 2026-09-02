"""
Unit and Integration tests for Redis-backed OTP and Single-Use Password Reset Token workflows.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.otp_service import OTPService


@pytest.mark.asyncio
async def test_otp_generation_and_verification_flow():
    """Test OTP creation, matching, and single-use burn."""
    test_email = "patient_otp_test@pillsync.app"

    # 1. Generate OTP
    otp = await OTPService.generate_otp(test_email, purpose="VERIFY")
    assert len(otp) == 6
    assert otp.isdigit()

    # 2. Verify with invalid OTP fails
    with pytest.raises(Exception):
        await OTPService.verify_otp(test_email, "000000", purpose="VERIFY")

    # 3. Verify with correct OTP succeeds
    assert await OTPService.verify_otp(test_email, otp, purpose="VERIFY") is True

    # 4. Verifying again fails (OTP is burned)
    with pytest.raises(Exception):
        await OTPService.verify_otp(test_email, otp, purpose="VERIFY")


@pytest.mark.asyncio
async def test_password_reset_token_flow():
    """Test cryptographic single-use password reset token lifecycle."""
    import uuid
    dummy_user_id = uuid.uuid4()
    test_email = "reset_user@pillsync.app"

    # 1. Create single-use token
    token = await OTPService.create_password_reset_token(dummy_user_id, test_email)
    assert len(token) >= 40

    # 2. Verify and consume token
    consumed_id, consumed_email = await OTPService.verify_and_consume_reset_token(token)
    assert consumed_id == str(dummy_user_id)
    assert consumed_email == test_email

    # 3. Replay attack fails (token was burned)
    with pytest.raises(Exception):
        await OTPService.verify_and_consume_reset_token(token)
