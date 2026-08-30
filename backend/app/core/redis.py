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
# In-Memory Fallback Client for Standalone / Dev Mode
# ---------------------------------------------------------------------------
class InMemoryRedisFallback:
    """Provides in-memory Redis-like operations when Redis server is offline."""
    def __init__(self):
        self._store = {}
        self._lists = {}
        self._zsets = {}

    async def ping(self):
        return True

    async def get(self, key: str):
        val = self._store.get(key)
        return val

    async def set(self, key: str, value: Any, ex: Optional[int] = None):
        self._store[key] = str(value) if not isinstance(value, str) else value
        return True

    async def delete(self, *keys: str):
        for k in keys:
            self._store.pop(k, None)
            self._lists.pop(k, None)
            self._zsets.pop(k, None)
        return True

    async def incr(self, key: str):
        cur = int(self._store.get(key, 0)) + 1
        self._store[key] = str(cur)
        return cur

    async def expire(self, key: str, seconds: int):
        return True

    async def lpush(self, key: str, value: str):
        if key not in self._lists:
            self._lists[key] = []
        self._lists[key].insert(0, value)
        return len(self._lists[key])

    async def ltrim(self, key: str, start: int, end: int):
        if key in self._lists:
            self._lists[key] = self._lists[key][start:end + 1]
        return True

    async def lrange(self, key: str, start: int, end: int):
        lst = self._lists.get(key, [])
        if end == -1:
            return lst[start:]
        return lst[start:end + 1]

    async def lset(self, key: str, index: int, value: str):
        if key in self._lists and 0 <= index < len(self._lists[key]):
            self._lists[key][index] = value
            return True
        return False

    async def zadd(self, key: str, mapping: dict):
        if key not in self._zsets:
            self._zsets[key] = {}
        for member, score in mapping.items():
            self._zsets[key][member] = float(score)
        return len(mapping)

    async def zrangebyscore(self, key: str, min_score: float, max_score: float):
        zset = self._zsets.get(key, {})
        matched = [m for m, s in zset.items() if min_score <= s <= max_score]
        return sorted(matched, key=lambda m: zset[m])

    async def zremrangebyscore(self, key: str, min_score: float, max_score: float):
        zset = self._zsets.get(key, {})
        to_del = [m for m, s in zset.items() if min_score <= s <= max_score]
        for m in to_del:
            del zset[m]
        return len(to_del)

    async def zcard(self, key: str):
        return len(self._zsets.get(key, {}))

    async def scan(self, cursor: int = 0, match: Optional[str] = None, count: int = 100):
        import fnmatch
        all_keys = list(self._store.keys()) + list(self._lists.keys()) + list(self._zsets.keys())
        if match:
            matched = fnmatch.filter(all_keys, match)
        else:
            matched = all_keys
        return 0, list(set(matched))

    async def close(self):
        self._store.clear()
        self._lists.clear()
        self._zsets.clear()


_in_memory_fallback = InMemoryRedisFallback()


# ---------------------------------------------------------------------------
# Redis Client Singleton
# ---------------------------------------------------------------------------
_redis_client: Optional[Any] = None


async def connect_redis() -> Any:
    """
    Initialize the async Redis connection pool.
    Falls back to InMemoryRedisFallback if Redis server is offline.
    """
    global _redis_client
    try:
        client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
            socket_timeout=2.0,
        )
        await client.ping()
        _redis_client = client
        print(f"[PillSync] Redis connected: {settings.REDIS_URL}")
        return _redis_client
    except Exception as err:
        print(f"[PillSync] Redis server not available ({err}). Using in-memory fallback.")
        _redis_client = _in_memory_fallback
        return _redis_client


async def disconnect_redis() -> None:
    """Close the Redis connection pool. Called during shutdown."""
    global _redis_client
    if _redis_client and _redis_client is not _in_memory_fallback:
        await _redis_client.close()
        _redis_client = None
        print("[PillSync] Redis connection closed.")


def get_redis() -> Any:
    """
    FastAPI dependency — returns the active Redis client or in-memory fallback.
    """
    global _redis_client
    if _redis_client is None:
        return _in_memory_fallback
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
