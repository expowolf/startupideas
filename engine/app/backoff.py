"""Retry with exponential backoff. Yahoo rate-limits aggressively; FRED occasionally 5xx's."""
from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")


class PermanentError(Exception):
    """An error retrying cannot fix (missing API key, unknown ticker)."""


def with_backoff(
    fn: Callable[[], T],
    retries: int = 4,
    base_delay: float = 2.0,
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    """Call fn; on exception wait base_delay * 2**attempt (+ jitter) and retry.

    Waits 2s, 4s, 8s, 16s by default, then re-raises the last error.
    PermanentError is raised immediately.
    """
    for attempt in range(retries + 1):
        try:
            return fn()
        except PermanentError:
            raise
        except Exception:
            if attempt == retries:
                raise
            sleep(base_delay * 2**attempt + random.uniform(0, 0.5))
    raise AssertionError("unreachable")
