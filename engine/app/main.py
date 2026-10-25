"""Swing Desk engine. Run: uvicorn app.main:app --reload --port 8000 (from /engine)."""
from __future__ import annotations

import os
import re

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.clients import fred, yahoo  # noqa: E402  (env must load first)

app = FastAPI(title="Swing Desk Engine")
app.add_middleware(
    CORSMiddleware,
    # Add your Vercel URL here (comma-separated) when the UI is deployed there.
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

TICKER_RE = re.compile(r"^[A-Z0-9.\-^=]{1,12}$")


def _ticker(raw: str) -> str:
    t = raw.upper()
    if not TICKER_RE.match(t):
        raise HTTPException(400, f"Invalid ticker: {raw}")
    return t


def _records(df):
    out = df.reset_index()
    out["Date"] = out["Date"].dt.strftime("%Y-%m-%d")
    return out.to_dict(orient="records")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/prices/{ticker}")
def prices(ticker: str):
    t = _ticker(ticker)
    try:
        df = yahoo.get_history(t)
    except Exception as e:
        raise HTTPException(502, f"Price fetch failed for {t}: {e}")
    return {"ticker": t, "bars": _records(df)}


@app.get("/api/macro/{series_id}")
def macro(series_id: str):
    sid = series_id.upper()
    if sid not in fred.CANDIDATE_SERIES:
        raise HTTPException(404, f"Unknown series: {sid}")
    try:
        df = fred.get_series(sid)
    except Exception as e:
        raise HTTPException(502, f"FRED fetch failed for {sid}: {e}")
    return {"id": sid, "points": _records(df)}
