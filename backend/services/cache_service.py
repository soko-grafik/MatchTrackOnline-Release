import time
import threading
from typing import Any, Optional, Dict, Tuple

class MemoryCache:
    """
    Thread-safe, high-performance in-memory TTL cache for FastAPI backend.
    Used for caching slow-changing metadata (settings, teams, holidays, trainers).
    """
    def __init__(self):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            val, expiry = entry
            if time.time() > expiry:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        with self._lock:
            self._cache[key] = (value, time.time() + ttl_seconds)

    def invalidate(self, key_prefix: str) -> None:
        with self._lock:
            keys_to_del = [k for k in self._cache.keys() if k.startswith(key_prefix)]
            for k in keys_to_del:
                del self._cache[k]

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

# Global cache instance
backend_cache = MemoryCache()
