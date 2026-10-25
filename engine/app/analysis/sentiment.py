"""Market psychology from clean free sources only: VIX (FRED) and the ticker's own price/volume."""
from __future__ import annotations

import pandas as pd

from app import indicators as ind
from app.clients import fred, yahoo

GAP_PCT = 2.0


def crowd(df: pd.DataFrame, window: int = 60) -> dict:
    close, vol = df["Close"], df["Volume"]
    sma50 = ind.sma(close, 50)
    gaps = (df["Open"] / close.shift(1) - 1).abs() * 100
    recent = gaps.iloc[-window:]
    st = int(ind.streak(close).iloc[-1])
    return {
        "pct_above_sma50": float((close.iloc[-1] / sma50.iloc[-1] - 1) * 100),
        "days_above_sma50_of_last_50": int((close.iloc[-50:] > sma50.iloc[-50:]).sum()),
        "gap_days": int((recent > GAP_PCT).sum()),
        "gap_window": window,
        "gap_threshold_pct": GAP_PCT,
        "volume_vs_avg50": float(vol.iloc[-1] / vol.iloc[-51:-1].mean()),
        "streak": st,
    }


def vix_stats() -> dict | None:
    try:
        v = fred.get_series("VIXCLS")["value"].dropna()
    except Exception:
        return None
    last_year = v[v.index >= v.index[-1] - pd.DateOffset(years=1)]
    cur = float(v.iloc[-1])
    return {"value": cur, "date": v.index[-1].strftime("%Y-%m-%d"), "percentile_1y": float((last_year < cur).mean() * 100)}


def analyze(ticker: str) -> dict:
    return {"vix": vix_stats(), "crowd": crowd(yahoo.get_history(ticker))}
