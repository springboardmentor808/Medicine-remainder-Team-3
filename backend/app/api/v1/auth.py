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
from app.services.email_service import (
    send_otp_email,
    send_password_reset_link,
    send_welcome_email,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Temporary in-memory OTP cache: { "email": { "otp": "123456", "expires_at": float } }
_OTP_STORE = {}


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
    - Sends welcome email.
    """
    # Ensure username is populated
    target_username = payload.username
    if not target_username:
        email_prefix = payload.email.split("@")[0].lower().replace("-", "_").replace(".", "_")
        target_username = email_prefix if len(email_prefix) >= 3 else f"{email_prefix}_usr"

    # Check for existing email
    existing_email = await db.execute(select(User).where(func.lower(User.email) == func.lower(payload.email)))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address is already registered.",
        )

    # If username collision occurs, append unique suffix
    existing_uname = await db.execute(select(User).where(func.lower(User.username) == func.lower(target_username)))
    if existing_uname.scalar_one_or_none():
        target_username = f"{target_username[:40]}_{uuid.uuid4().hex[:6]}"

    # Create new user
    new_user = User(
        username=target_username,
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

    # Send welcome email (non-blocking, don't fail registration if email fails)
    try:
        await send_welcome_email(new_user.email, new_user.full_name)
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
# POST /api/v1/auth/logout
# ===================================================================
@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="User logout",
    description="Invalidate the current session. Client should clear stored tokens.",
)
async def logout():
    """
    Logout endpoint.
    Since JWTs are stateless, the client is responsible for clearing tokens.
    This endpoint acknowledges the logout request.
    """
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset OTP",
    description="Generates and dispatches a 6-digit OTP to the registered email. Also sends a password reset link.",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate and send 6-digit OTP code + reset link for password reset."""
    email_clean = payload.email.strip().lower()

    # Check if user exists
    result = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    user = result.scalar_one_or_none()

    # Generate 6-digit numeric OTP
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + (10 * 60)  # 10 minutes validity

    _OTP_STORE[email_clean] = {
        "otp": otp_code,
        "expires_at": expires_at,
    }

    # Send OTP email
    try:
        await send_otp_email(email_clean, otp_code, purpose="password_reset")
    except Exception as e:
        logger.warning(f"[Auth] OTP email send failed: {e}")

    # Also send reset link with OTP as token
    try:
        await send_password_reset_link(email_clean, otp_code)
    except Exception as e:
        logger.warning(f"[Auth] Reset link email send failed: {e}")

    response = MessageResponse(
        message="A 6-digit OTP has been dispatched to your registered email. You can also use the reset link sent to your email.",
        detail=f"OTP sent to {email_clean}",
    )

    # Only include debug_otp in development mode
    if settings.DEBUG:
        response.debug_otp = otp_code

    return response


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
    "/resend-otp",
    response_model=MessageResponse,
    summary="Resend OTP code",
    description="Generates and dispatches a new 6-digit OTP to the registered email.",
)
async def resend_otp(payload: ForgotPasswordRequest):
    """Resend OTP to the provided email."""
    email_clean = payload.email.strip().lower()

    # Generate new OTP
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + (10 * 60)

    _OTP_STORE[email_clean] = {
        "otp": otp_code,
        "expires_at": expires_at,
    }

    # Send via email
    try:
        await send_otp_email(email_clean, otp_code, purpose="password_reset")
    except Exception as e:
        logger.warning(f"[Auth] Resend OTP email failed: {e}")

    response = MessageResponse(
        message="A new OTP has been sent to your email.",
        detail=f"OTP resent to {email_clean}",
    )

    if settings.DEBUG:
        response.debug_otp = otp_code

    return response


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
