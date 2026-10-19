"""FRED wrapper via fredapi, cached in SQLite. Needs FRED_API_KEY in the environment."""
from __future__ import annotations

import os
from datetime import datetime

import pandas as pd
from fredapi import Fred

from app.backoff import with_backoff
from app.db import get_cached, put_cached

FRED_TTL = 12 * 3600

# Candidates from the build prompt. scripts/validate.py checks each is live before we rely on it.
CANDIDATE_SERIES = [
    "DGS10", "DGS2", "DGS3MO", "T10Y2Y", "T10Y3M", "DFF",
    "CPIAUCSL", "CPILFESL", "UNRATE", "ICSA", "BAMLH0A0HYM2", "VIXCLS",
]

# Max days since last observation before a series counts as stale, by FRED frequency code.
STALE_DAYS = {"D": 10, "W": 21, "M": 75, "Q": 200}


def _client() -> Fred:
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY is not set (see .env.example)")
    return Fred(api_key=key)


def get_series(series_id: str) -> pd.DataFrame:
    def fetch() -> pd.DataFrame:
        s = _client().get_series(series_id).dropna()
        df = s.to_frame("value")
        df.index.name = "Date"
        return df

    hit = get_cached(f"fred:{series_id}", FRED_TTL)
    if hit is not None:
        return hit
    df = with_backoff(fetch)
    put_cached(f"fred:{series_id}", df)
    return df


def get_series_info(series_id: str) -> dict:
    def fetch() -> dict:
        info = _client().get_series_info(series_id)
        return {
            "id": series_id,
            "title": info["title"],
            "frequency": info["frequency_short"],
            "units": info["units_short"],
            "last_observation": str(info["observation_end"])[:10],
        }

    hit = get_cached(f"fredinfo:{series_id}", FRED_TTL)
    if hit is not None:
        return hit
    info = with_backoff(fetch)
    put_cached(f"fredinfo:{series_id}", info)
    return info


def is_stale(info: dict, today: datetime | None = None) -> bool:
    today = today or datetime.now()
    last = datetime.fromisoformat(info["last_observation"])
    return (today - last).days > STALE_DAYS.get(info["frequency"], 30)
