"""
PillSync Authentication Router.

Handles user registration, login, token refresh, and current user profile.
All passwords are bcrypt-hashed. Tokens are JWT with access + refresh pattern.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, or_
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
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
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

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fields 'username' and 'password' are required.",
        )

    result = await db.execute(
        select(User).where(
            or_(
                User.username == username,
                User.email == username,
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
