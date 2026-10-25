"""Earnings surprises and the market's reaction to each report."""
from __future__ import annotations

from datetime import datetime

import pandas as pd

from app.clients import yahoo

HOLD_WINDOW_DAYS = 14  # a typical 2-week swing hold


def reaction_index(dates: pd.DatetimeIndex, when: pd.Timestamp) -> tuple[int | None, str]:
    """Index of the first session that trades on the news.

    Before ~9:30 ET the report is pre-market, so that day reacts; otherwise (after close or
    unknown time) the next session reacts. yfinance times are US/Eastern wall-clock.
    """
    day = when.normalize()
    timing = "BMO" if when.hour + when.minute / 60 < 9.5 and when.hour != 0 else ("AMC" if when.hour != 0 else "unknown")
    pos = dates.searchsorted(day, side="left" if timing == "BMO" else "right")
    return (int(pos) if pos < len(dates) else None), timing


def events(ticker: str, prices: pd.DataFrame | None = None, limit: int = 40) -> pd.DataFrame:
    """One row per reported quarter: estimate, actual, surprise, reaction-day index and returns."""
    e = yahoo.get_earnings_dates(ticker, limit)
    if e.empty:
        return pd.DataFrame()
    e.index = pd.to_datetime(e.index)
    prices = prices if prices is not None else yahoo.get_history(ticker)
    close, idx = prices["Close"], prices.index
    rows = []
    for when, r in e[e["Reported EPS"].notna()].sort_index().iterrows():
        i, timing = reaction_index(idx, pd.Timestamp(when))
        if i is None or i == 0:
            continue
        base = close.iloc[i - 1]
        est, act = r.get("EPS Estimate"), r.get("Reported EPS")
        surprise = r.get("Surprise(%)")
        if pd.isna(surprise) and pd.notna(est) and est not in (0,):
            surprise = (act - est) / abs(est) * 100
        rows.append({
            "date": pd.Timestamp(when).strftime("%Y-%m-%d"),
            "timing": timing,
            "reaction_i": i,
            "estimate": est,
            "actual": act,
            "surprise_pct": surprise,
            "ret_1d": (close.iloc[i] / base - 1) * 100,
            "ret_5d": (close.iloc[i + 4] / base - 1) * 100 if i + 4 < len(close) else None,
        })
    return pd.DataFrame(rows)


def next_date(ticker: str) -> pd.Timestamp | None:
    e = yahoo.get_earnings_dates(ticker, 12)
    if e.empty:  # funds (SPY, sector ETFs) have no earnings
        return None
    e.index = pd.to_datetime(e.index)
    upcoming = e[(e["Reported EPS"].isna()) & (e.index >= pd.Timestamp(datetime.now().date()))]
    return pd.Timestamp(upcoming.index.min()) if len(upcoming) else None


def analyze(ticker: str) -> dict:
    ev = events(ticker)
    nxt = next_date(ticker)
    days_to = (nxt.normalize() - pd.Timestamp(datetime.now().date())).days if nxt is not None else None
    quarters = ev.drop(columns=["reaction_i"]).to_dict(orient="records") if len(ev) else []
    with_est = int(ev["estimate"].notna().sum()) if len(ev) else 0
    return {
        "quarters": quarters,
        "coverage": {"reported": len(quarters), "with_estimate": with_est},
        "next_date": nxt.strftime("%Y-%m-%d") if nxt is not None else None,
        "days_to_next": days_to,
        "inside_hold_window": days_to is not None and 0 <= days_to <= HOLD_WINDOW_DAYS,
        "hold_window_days": HOLD_WINDOW_DAYS,
    }


