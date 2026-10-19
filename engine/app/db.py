"""SQLite cache. One table, keyed by a string, payload stored as JSON text.

DataFrames are serialized with orient="split" so the index (dates) survives.
"""
from __future__ import annotations

import io
import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any

import pandas as pd

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "desk.db"


def db_path() -> Path:
    return Path(os.environ.get("DESK_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache ("
        " key TEXT PRIMARY KEY,"
        " fetched_at REAL NOT NULL,"
        " kind TEXT NOT NULL,"
        " payload TEXT NOT NULL)"
    )
    return conn


def get_cached(key: str, ttl_seconds: float) -> Any | None:
    """Return the cached value if it exists and is younger than ttl, else None."""
    with connect() as conn:
        row = conn.execute(
            "SELECT fetched_at, kind, payload FROM cache WHERE key = ?", (key,)
        ).fetchone()
    if row is None:
        return None
    fetched_at, kind, payload = row
    if time.time() - fetched_at > ttl_seconds:
        return None
    if kind == "df":
        return pd.read_json(io.StringIO(payload), orient="split", dtype=False)
    return json.loads(payload)


def put_cached(key: str, value: Any) -> None:
    if isinstance(value, pd.DataFrame):
        kind, payload = "df", value.to_json(orient="split", date_format="iso")
    else:
        kind, payload = "json", json.dumps(value, default=str)
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO cache (key, fetched_at, kind, payload) VALUES (?, ?, ?, ?)",
            (key, time.time(), kind, payload),
        )
