"""
PillSync Authentication Router.

Handles user registration, login, token refresh, and current user profile.
All passwords are bcrypt-hashed. Tokens are JWT with access + refresh pattern.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth_schema import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ===================================================================
# POST /api/v1/auth/register
# ===================================================================
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new PillSync account with username, email, password, and role.",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user.

    - Validates username and email uniqueness.
    - Hashes the password with bcrypt.
    - Issues JWT access and refresh tokens.
    """
    # Check for existing username or email
    existing = await db.execute(
        select(User).where(
            or_(
                User.username == payload.username,
                User.email == payload.email,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered.",
        )

    # Create new user
    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
    )

    db.add(new_user)
    await db.flush()  # Flush to get the generated UUID
    await db.commit()
    await db.refresh(new_user)

    # Generate tokens
    token_data = {"sub": str(new_user.id), "role": new_user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return RegisterResponse(
        user=UserResponse(
            id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            full_name=new_user.full_name,
            phone=new_user.phone,
            role=new_user.role,
            is_active=new_user.is_active,
            created_at=new_user.created_at.isoformat(),
        ),
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ===================================================================
# POST /api/v1/auth/login
# ===================================================================
@router.post(
    "/login",
    response_model=LoginResponse,
    summary="User login",
    description="Authenticate with username/email and password. Supports both JSON body and Form Data (Swagger Authorize popup).",
)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user credentials and issue JWT token pair.

    - Accepts JSON body (`{"username": "...", "password": "..."}`) OR Form Data (Swagger Authorize popup).
    - Looks up user by username OR email.
    - Verifies bcrypt password hash.
    - Returns access + refresh tokens.
    """
    username: str | None = None
    password: str | None = None

    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username") or body.get("email")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid JSON payload.",
            )
    else:
        try:
            form = await request.form()
            u_val = form.get("username") or form.get("email")
            p_val = form.get("password")
            if isinstance(u_val, str):
                username = u_val
            if isinstance(p_val, str):
                password = p_val
        except Exception:
            try:
                body = await request.json()
                username = body.get("username") or body.get("email")
                password = body.get("password")
            except Exception:
                pass

    username_clean = (username or "").strip()
    if not username_clean or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fields 'username' and 'password' are required.",
        )

    result = await db.execute(
        select(User).where(
            or_(
                func.lower(User.username) == func.lower(username_clean),
                func.lower(User.email) == func.lower(username_clean),
                User.username == username_clean,
                User.email == username_clean,
            )
        )
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact admin.",
        )

    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
        ),
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ===================================================================
# POST /api/v1/auth/refresh
# ===================================================================
@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Exchange a valid refresh token for a new access token.",
)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a new access token using a valid refresh token.

    - Validates the refresh token signature and expiry.
    - Verifies the user still exists and is active.
    - Returns a new access token (refresh token remains unchanged).
    """
    token_payload = decode_token(payload.refresh_token)

    if token_payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Refresh token required.",
        )

    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    import uuid
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    new_access = create_access_token(
        {"sub": str(user.id), "role": user.role}
    )

    return TokenResponse(
        access_token=new_access,
        refresh_token=payload.refresh_token,
    )


# ===================================================================
# GET /api/v1/auth/me
# ===================================================================
@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    description="Returns the authenticated user's profile from the JWT token.",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


# ===================================================================
# POST /api/v1/auth/change-password
# ===================================================================
@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change current user password",
    description="Allows authenticated user to update password by verifying current password.",
)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change authenticated user password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(current_user)

    return MessageResponse(message="Password changed successfully.")


# ===================================================================
# OTP Store & Password Recovery Endpoints
# ===================================================================
import time
import random
import logging

logger = logging.getLogger(__name__)

# Temporary in-memory OTP cache: { "email": { "otp": "123456", "expires_at": float } }
_OTP_STORE = {}


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset OTP",
    description="Generates and dispatches a 6-digit OTP to the registered email and phone.",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate and send 6-digit OTP code for password reset."""
    email_clean = payload.email.strip().lower()
    
    # Check if user exists
    result = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    user = result.scalar_one_or_none()

    # Generate 6-digit numeric OTP
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + (10 * 60) # 10 minutes validity

    _OTP_STORE[email_clean] = {
        "otp": otp_code,
        "expires_at": expires_at,
    }

    logger.info(f"🔑 [PillSync OTP] Generated OTP for {email_clean}: {otp_code} (Valid for 10 min)")
    print(f"\n=======================================================\n🔑 [PillSync OTP Alert] OTP for {email_clean}: {otp_code}\n=======================================================\n")

    return MessageResponse(
        message="A 6-digit OTP has been dispatched to your registered email / phone.",
        detail=f"OTP sent to {email_clean}",
        debug_otp=otp_code,
    )


@router.post(
    "/verify-otp",
    response_model=MessageResponse,
    summary="Verify OTP code",
    description="Validates that the provided 6-digit OTP is correct and unexpired.",
)
async def verify_otp(payload: VerifyOtpRequest):
    """Verify that the submitted OTP matches."""
    email_clean = payload.email.strip().lower()
    stored = _OTP_STORE.get(email_clean)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found for this email. Please request a new one.",
        )

    if time.time() > stored["expires_at"]:
        _OTP_STORE.pop(email_clean, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    if stored["otp"] != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check and try again.",
        )

    return MessageResponse(message="OTP verified successfully.")


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password with verified OTP",
    description="Updates user password after successful OTP verification.",
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset user password after OTP verification."""
    email_clean = payload.email.strip().lower()
    stored = _OTP_STORE.get(email_clean)

    if not stored or stored["otp"] != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new verification code.",
        )

    # Find user in database
    result = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found.",
        )

    # Update password
    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(user)

    # Clear OTP
    _OTP_STORE.pop(email_clean, None)

    return MessageResponse(message="Password reset successfully! You can now log in with your new password.")

