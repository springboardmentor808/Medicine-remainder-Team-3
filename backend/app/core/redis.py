"""
PillSync Redis Client Module.

Provides an async Redis connection for:
    - Cache: Store/retrieve frequently accessed data.
    - Sessions: Manage user login sessions and token blacklisting.
    - Reminder Queues: Sorted sets for scheduled medicine reminders.
    - Rate Limiting: API request counting per user/IP.
"""

import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings


# ---------------------------------------------------------------------------
# Redis Client Singleton
# ---------------------------------------------------------------------------
_redis_client: Optional[aioredis.Redis] = None


async def connect_redis() -> aioredis.Redis:
    """
    Initialize the async Redis connection pool.

    Called once during application startup via the FastAPI lifespan.
    """
    global _redis_client
    _redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    # Verify connectivity
    await _redis_client.ping()
    print(f"[PillSync] Redis connected: {settings.REDIS_URL}")
    return _redis_client


async def disconnect_redis() -> None:
    """Close the Redis connection pool. Called during shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        print("[PillSync] Redis connection closed.")


def get_redis() -> aioredis.Redis:
    """
    FastAPI dependency — returns the active Redis client.

    Usage:
        @router.get("/example")
        async def example(redis: aioredis.Redis = Depends(get_redis)):
            ...
    """
    if _redis_client is None:
        raise RuntimeError(
            "Redis client not initialized. "
            "Ensure connect_redis() is called during app startup."
        )
    return _redis_client


# ---------------------------------------------------------------------------
# Cache Helpers
# ---------------------------------------------------------------------------

async def cache_set(
    key: str,
    value: Any,
    ttl_seconds: int = 300,
) -> None:
    """
    Store a value in Redis cache with a TTL.

    Args:
        key: Cache key (e.g., "user:uuid:medicines").
        value: Data to cache (dict/list will be JSON-serialized).
        ttl_seconds: Time-to-live in seconds (default: 5 minutes).
    """
    client = get_redis()
    serialized = json.dumps(value, default=str)
    await client.set(key, serialized, ex=ttl_seconds)


async def cache_get(key: str) -> Optional[Any]:
    """
    Retrieve a cached value by key.

    Returns:
        Deserialized Python object, or None if key doesn't exist.
    """
    client = get_redis()
    data = await client.get(key)
    if data is None:
        return None
    return json.loads(data)


async def cache_delete(key: str) -> None:
    """Delete a cache entry by key."""
    client = get_redis()
    await client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    """
    Delete all cache entries matching a glob pattern.

    Example: cache_delete_pattern("user:abc123:*")
    """
    client = get_redis()
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor=cursor, match=pattern, count=100)
        if keys:
            await client.delete(*keys)
        if cursor == 0:
            break


# ---------------------------------------------------------------------------
# Session Management
# ---------------------------------------------------------------------------

async def store_session(
    user_id: str,
    token_jti: str,
    ttl_seconds: int = 3600,
) -> None:
    """
    Track an active user session in Redis.

    Args:
        user_id: UUID string of the user.
        token_jti: Unique JWT token identifier.
        ttl_seconds: Session lifetime (default: 1 hour).
    """
    client = get_redis()
    key = f"session:{user_id}:{token_jti}"
    await client.set(key, "active", ex=ttl_seconds)


async def get_session(user_id: str, token_jti: str) -> Optional[str]:
    """Check if a session is still active."""
    client = get_redis()
    return await client.get(f"session:{user_id}:{token_jti}")


async def invalidate_session(user_id: str, token_jti: str) -> None:
    """Invalidate a specific session (logout)."""
    client = get_redis()
    await client.delete(f"session:{user_id}:{token_jti}")


async def invalidate_all_sessions(user_id: str) -> None:
    """Invalidate all sessions for a user (force logout everywhere)."""
    await cache_delete_pattern(f"session:{user_id}:*")


# ---------------------------------------------------------------------------
# Token Blacklist (for Logout)
# ---------------------------------------------------------------------------

async def blacklist_token(
    token_jti: str,
    ttl_seconds: int = 86400,
) -> None:
    """
    Add a JWT token to the blacklist (used on logout).

    Args:
        token_jti: The JWT's unique identifier (jti claim).
        ttl_seconds: How long to keep it blacklisted (default: 24h).
    """
    client = get_redis()
    await client.set(f"blacklist:{token_jti}", "1", ex=ttl_seconds)


async def is_token_blacklisted(token_jti: str) -> bool:
    """Check if a token has been blacklisted."""
    client = get_redis()
    result = await client.get(f"blacklist:{token_jti}")
    return result is not None


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------

async def check_rate_limit(
    identifier: str,
    max_requests: int = 60,
    window_seconds: int = 60,
) -> tuple[bool, int]:
    """
    Simple sliding-window rate limiter.

    Args:
        identifier: Unique key (e.g., user_id or IP address).
        max_requests: Maximum allowed requests in the window.
        window_seconds: Time window in seconds.

    Returns:
        Tuple of (is_allowed: bool, remaining: int).
    """
    client = get_redis()
    key = f"ratelimit:{identifier}"
    current = await client.get(key)

    if current is None:
        await client.set(key, 1, ex=window_seconds)
        return True, max_requests - 1

    count = int(current)
    if count >= max_requests:
        return False, 0

    await client.incr(key)
    return True, max_requests - count - 1
