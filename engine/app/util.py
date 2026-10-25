"""JSON helpers: FastAPI cannot serialize NaN/inf or numpy scalars."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def clean(x: Any) -> Any:
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        f = float(x)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(x, (np.bool_,)):
        return bool(x)
    if isinstance(x, (pd.Timestamp,)):
        return x.strftime("%Y-%m-%d")
    return x


def series_points(s: pd.Series, digits: int = 4) -> list[dict]:
    """[{date, value}] skipping NaN."""
    s = s.dropna()
    return [{"date": d.strftime("%Y-%m-%d"), "value": round(float(v), digits)} for d, v in s.items()]
