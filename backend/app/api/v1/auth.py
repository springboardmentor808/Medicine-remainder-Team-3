"""
PillSync Authentication Router.

Handles user registration, login, token refresh, current user profile,
password recovery (OTP + reset link), and logout.
All passwords are bcrypt-hashed. Tokens are JWT with access + refresh pattern.
"""

import time
import random
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.redis import get_redis
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
    SendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyOTPRequest,
    VerifyOtpRequest,
)
from app.services.otp_service import OTPService
from app.services.email_service import EmailService
from app.services.sms_service import SMSService, normalize_phone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Note: OTPs are now stored in Redis (or InMemoryRedisFallback) via cache_set/cache_get
# under key pattern 'otp:{email}' with 10-minute TTL for multi-worker safety.


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

    - Validates username and email uniqueness (case-insensitive).
    - Hashes the password with bcrypt.
    - Issues JWT access and refresh tokens.
    - Sends welcome email.
    """
    clean_email = payload.email.strip().lower()
    target_username = payload.username.strip().lower() if payload.username else ""
    if not target_username:
        email_prefix = clean_email.split("@")[0].replace("-", "_").replace(".", "_")
        target_username = email_prefix if len(email_prefix) >= 3 else f"{email_prefix}_usr"

    # Check for existing email
    existing_email = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address is already registered.",
        )

    # Enforce email verification
    is_email_ver = await OTPService.is_destination_verified(clean_email, channel="email")
    if not is_email_ver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address has not been verified. Please complete email OTP verification before registering.",
        )

    # Enforce phone verification if phone is provided
    if payload.phone:
        is_phone_ver = await OTPService.is_destination_verified(payload.phone, channel="phone")
        if not is_phone_ver:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number has not been verified. Please complete mobile OTP verification before registering.",
            )

    # If username collision occurs, append unique suffix
    existing_uname = await db.execute(select(User).where(func.lower(User.username) == target_username))

    if existing_uname.scalar_one_or_none():
        target_username = f"{target_username[:40]}_{uuid.uuid4().hex[:6]}"

    # Create new user with normalized fields
    new_user = User(
        username=target_username,
        email=clean_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
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

    # Send welcome email (non-blocking, don't fail registration if email fails)
    try:
        await EmailService.send_welcome_email(new_user.email, new_user.full_name, new_user.role)
    except Exception as e:
        logger.warning(f"[Auth] Welcome email failed for {new_user.email}: {e}")

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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
# POST /api/v1/auth/logout
# ===================================================================
@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="User logout",
    description="Invalidate the current session and add token to Redis blacklist.",
)
async def logout(request: Request):
    """
    Logout endpoint.
    Adds the caller's JWT token to the Redis revocation blacklist for remaining TTL.
    """
    token = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif "pillsync_access_token" in request.cookies:
        token = request.cookies.get("pillsync_access_token", "").strip()

    if token:
        try:
            redis = get_redis()
            if redis:
                await redis.set(f"blacklist:{token}", "revoked", ex=3600)
        except Exception:
            pass


    return MessageResponse(message="Logged out successfully.")


# ===================================================================
# POST /api/v1/auth/demo-login
# ===================================================================
@router.post(
    "/demo-login",
    response_model=LoginResponse,
    summary="1-Click Demo Login",
    description="Logs in or automatically provisions a real database user for a demo role (patient, caregiver, admin) and issues real JWT tokens.",
)
async def demo_login(
    role: str = "patient",
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate or automatically create a demo user in PostgreSQL and return real JWT tokens.
    """
    role_clean = role.lower().strip()
    if role_clean not in ["patient", "caregiver", "admin"]:
        role_clean = "patient"

    email_map = {
        "admin": ("admin@pillsync.com", "Admin Superuser", "admin"),
        "caregiver": ("caregiver@pillsync.com", "Dr. Sarah Kim", "drsarah"),
        "patient": ("patient@pillsync.com", "Eleanor Martinez", "eleanor"),
    }

    email, name, uname = email_map[role_clean]

    # Find or auto-provision demo user in DB
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        res2 = await db.execute(select(User).where(User.username == uname))
        user = res2.scalar_one_or_none()

    if not user:
        user = User(
            username=uname,
            email=email,
            hashed_password=hash_password("DemoPassword123!"),
            full_name=name,
            phone="+1234567890",
            role=role_clean,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.commit()
        await db.refresh(user)

    # Issue real tokens
    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(token_data)
    refresh_token_str = create_refresh_token(token_data)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat() if hasattr(user.created_at, 'isoformat') else str(user.created_at),
        ),
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
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a new access token using a valid refresh token.

    Accepts refresh_token from JSON body or Authorization header.
    """
    # Try to get refresh token from JSON body first
    refresh_tok = None
    try:
        body = await request.json()
        refresh_tok = body.get("refresh_token")
    except Exception:
        pass

    # Fallback: try Authorization header
    if not refresh_tok:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            refresh_tok = auth_header[7:]

    if not refresh_tok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="refresh_token is required in body or Authorization header.",
        )

    token_payload = decode_token(refresh_tok)

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
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_tok,
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
# OTP & Password Recovery Endpoints
# ===================================================================

# ===================================================================
# OTP & Password Recovery Endpoints
# ===================================================================

@router.post(
    "/send-otp",
    response_model=MessageResponse,
    summary="Dispatch 6-digit verification code",
    description="Generates a 6-digit cryptographic OTP, hashes it in Redis (5-min TTL), and dispatches via Email or SMS.",
)
async def send_otp(payload: SendOTPRequest):
    """Generate and dispatch 6-digit OTP verification code."""
    channel = (payload.channel or "email").strip().lower()
    dest = (payload.destination or payload.email or payload.phone or "").strip()
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Destination (email address or phone number) is required.",
        )
    if "@" in dest:
        channel = "email"
    elif channel != "email" and any(c.isdigit() for c in dest):
        channel = "phone"

    await OTPService.check_rate_limit(dest, channel=channel)
    otp_code = await OTPService.generate_otp(dest, channel=channel, purpose=payload.purpose)

    if channel == "email":
        await EmailService.send_otp_email(dest, otp_code, purpose=payload.purpose)
    else:
        await SMSService.send_otp_sms(dest, otp_code, purpose=payload.purpose)

    response = MessageResponse(
        message=f"A 6-digit verification code has been dispatched to your {channel}.",
        detail=f"OTP sent to {dest} via {channel}",
    )
    if settings.DEBUG:
        response.debug_otp = otp_code
    return response


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset",
    description="Generates a single-use password reset token and OTP, dispatching via email.",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Initiate password recovery with single-use reset token and OTP."""
    email_clean = payload.email.strip().lower()

    result = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    user = result.scalar_one_or_none()

    otp_code = None
    if user:
        reset_token = await OTPService.create_password_reset_token(user.id, email_clean)
        otp_code = await OTPService.generate_otp(email_clean, channel="email", purpose="PASSWORD_RESET")
        await EmailService.send_password_reset_email(email_clean, reset_token)
        await EmailService.send_otp_email(email_clean, otp_code, purpose="PASSWORD_RESET")

    response = MessageResponse(
        message="If an account exists for this email, password recovery instructions have been dispatched.",
        detail=f"Recovery sent to {email_clean}",
    )
    if settings.DEBUG and otp_code:
        response.debug_otp = otp_code
    return response


@router.post(
    "/verify-otp",
    response_model=MessageResponse,
    summary="Verify 6-digit OTP code",
    description="Validates that the provided 6-digit OTP matches Redis hash within 5-min TTL.",
)
async def verify_otp(payload: VerifyOTPRequest):
    """Verify 6-digit OTP code with attempt limiting."""
    channel = (payload.channel or "email").strip().lower()
    dest = (payload.destination or payload.email or payload.phone or "").strip()
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Destination (email address or phone number) is required.",
        )
    if "@" in dest:
        channel = "email"
    elif channel != "email" and any(c.isdigit() for c in dest):
        channel = "phone"

    await OTPService.verify_otp(dest, payload.otp, channel=channel, purpose=payload.purpose)
    return MessageResponse(
        message=f"{channel.capitalize()} verified successfully.",
        detail=f"{dest} verified",
    )



@router.post(
    "/resend-otp",
    response_model=MessageResponse,
    summary="Resend OTP code",
    description="Generates and dispatches a fresh 6-digit OTP code.",
)
async def resend_otp(payload: ForgotPasswordRequest):
    """Resend 6-digit OTP to user email."""
    email_clean = payload.email.strip().lower()
    otp_code = await OTPService.generate_otp(email_clean, purpose="PASSWORD_RESET")
    await EmailService.send_otp_email(email_clean, otp_code, purpose="PASSWORD_RESET")

    response = MessageResponse(
        message="A new 6-digit OTP has been sent to your email.",
        detail=f"OTP resent to {email_clean}",
    )
    if settings.DEBUG:
        response.debug_otp = otp_code
    return response


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete password reset",
    description="Updates user password after consuming a single-use token or verifying OTP.",
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset user password using single-use cryptographic token."""
    user_id_str, email = await OTPService.verify_and_consume_reset_token(payload.token)

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this reset token could not be found.",
        )

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(user)

    return MessageResponse(message="Password reset successfully! You can now log in with your new credentials.")
