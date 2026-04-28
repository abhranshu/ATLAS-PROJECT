# ─── Redis Cache Helper ────────────────────────────────────
# Thin wrapper around the redis-py client.
# All values are JSON-serialised so any dict/list can be cached.
# ──────────────────────────────────────────────────────────

import json
import logging
from typing import Any, Optional

import redis

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Connection Pool ──────────────────────────────────────
_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    """Return the shared Redis client, or None if Redis is unavailable."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            _redis_client.ping()
            logger.info("✅ Redis connected at %s", settings.REDIS_URL)
        except Exception as exc:
            logger.warning("⚠️  Redis unavailable (%s) — caching disabled", exc)
            _redis_client = None
    return _redis_client


# ─── Public Helpers ───────────────────────────────────────

def cache_get(key: str) -> Optional[Any]:
    """Return cached value for `key`, or None on miss / Redis error."""
    client = get_redis()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.warning("cache_get error for key=%s: %s", key, exc)
        return None


def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Serialise `value` to JSON and store under `key` with a TTL (seconds)."""
    client = get_redis()
    if client is None:
        return
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("cache_set error for key=%s: %s", key, exc)


def cache_delete(key: str) -> None:
    """Invalidate a specific cache key."""
    client = get_redis()
    if client is None:
        return
    try:
        client.delete(key)
    except Exception as exc:
        logger.warning("cache_delete error for key=%s: %s", key, exc)


def cache_delete_pattern(pattern: str) -> None:
    """Invalidate all keys matching a glob pattern (e.g. 'atlas:devices:*')."""
    client = get_redis()
    if client is None:
        return
    try:
        keys = client.keys(pattern)
        if keys:
            client.delete(*keys)
    except Exception as exc:
        logger.warning("cache_delete_pattern error for pattern=%s: %s", pattern, exc)


# ─── Cache Key Constants ──────────────────────────────────
class CacheKeys:
    DASHBOARD_OVERVIEW   = "atlas:dashboard:overview"
    DASHBOARD_HEALTH     = "atlas:dashboard:health"
    DASHBOARD_GEO        = "atlas:dashboard:geo"
    DEVICES_LIST         = "atlas:devices:list"
    NETWORK_MAP          = "atlas:network:map"
    NETWORK_NODES        = "atlas:network:nodes"
    NETWORK_CONNECTIONS  = "atlas:network:connections"
    TRUST_OVERVIEW       = "atlas:trust:overview"
    TRUST_BREAKDOWN      = "atlas:trust:breakdown"
    INCIDENTS_OVERVIEW   = "atlas:incidents:overview"

    @staticmethod
    def device_detail(device_id: str) -> str:
        return f"atlas:devices:{device_id}"

    @staticmethod
    def trust_timeline(from_ts: str, to_ts: str) -> str:
        return f"atlas:trust:timeline:{from_ts}:{to_ts}"
