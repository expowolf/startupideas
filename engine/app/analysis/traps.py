"""Trap detector: how often this stock's obvious setups fail, measured from daily OHLCV.

It cannot tell who caused a move (that needs order-book data). It measures outcomes, and
compares them with SPY and the sector ETF so "this stock traps people" is a testable claim.
"""
from __future__ import annotations

import pandas as pd

from app.analysis.technicals import sector_etf
from app.clients import yahoo

BREAKOUT_LOOKBACK = 20   # close above the prior 20-day closing high
FAIL_WINDOW = 3          # ...then closes back below that level within 3 sessions
SWING_LOOKBACK = 10      # low pierces the prior 10-day low but the close recovers above it
GAP_PCT = 3.0            # open gaps at least 3% from prior close
FADE_WINDOW = 5          # gap fully filled (close back through prior close) within 5 sessions


def measure(df: pd.DataFrame, years: int = 5) -> dict:
    df = df[df.index >= df.index[-1] - pd.DateOffset(years=years)]
    c, o, lo = df["Close"], df["Open"], df["Low"]
    n = len(df)

    level = c.rolling(BREAKOUT_LOOKBACK).max().shift(1)
    breakouts, failed = [], 0
    for i in range(BREAKOUT_LOOKBACK + 1, n - FAIL_WINDOW):
        if c.iloc[i] > level.iloc[i] and c.iloc[i - 1] <= level.iloc[i - 1]:
            f = bool((c.iloc[i + 1:i + 1 + FAIL_WINDOW] < level.iloc[i]).any())
            failed += f
            breakouts.append({"date": df.index[i].strftime("%Y-%m-%d"), "level": float(level.iloc[i]), "failed": f})

    swing = lo.rolling(SWING_LOOKBACK).min().shift(1)
    sweep_mask = (lo < swing) & (c > swing)
    sweeps = []
    for i in [k for k in range(n) if sweep_mask.iloc[k]]:
        fwd = (c.iloc[i + 5] / c.iloc[i] - 1) * 100 if i + 5 < n else None
        sweeps.append({"date": df.index[i].strftime("%Y-%m-%d"), "level": float(swing.iloc[i]), "fwd_5d_pct": fwd})

    gap = (o / c.shift(1) - 1) * 100
    gaps, faded = [], 0
    for i in range(1, n - FADE_WINDOW):
        g = gap.iloc[i]
        if abs(g) < GAP_PCT:
            continue
        prev = c.iloc[i - 1]
        nxt = c.iloc[i:i + FADE_WINDOW]
        f = bool((nxt <= prev).any() if g > 0 else (nxt >= prev).any())
        faded += f
        gaps.append({"date": df.index[i].strftime("%Y-%m-%d"), "gap_pct": float(g), "faded": f})

    return {
        "bars": n,
        "breakouts": len(breakouts), "breakout_fail_rate": failed / len(breakouts) * 100 if breakouts else None,
        "sweeps": len(sweeps), "sweeps_per_100_days": len(sweeps) / n * 100 if n else None,
        "gaps": len(gaps), "gap_fade_rate": faded / len(gaps) * 100 if gaps else None,
        "recent": {"breakouts": breakouts[-8:], "sweeps": sweeps[-8:], "gaps": gaps[-8:]},
    }


def tag_headlines(gaps: list[dict], news: list[dict]) -> list[dict]:
    out = []
    for g in gaps:
        d = pd.Timestamp(g["date"])
        near = [h for h in news if abs((pd.Timestamp(h["published"]).normalize() - d).days) <= 1]
        out.append({**g, "headlines": near})
    return out


def analyze(ticker: str) -> dict:
    me = measure(yahoo.get_history(ticker))
    baselines = {}
    for b in ("SPY", sector_etf(ticker)):
        if b and b != ticker:
            try:
                m = measure(yahoo.get_history(b))
                baselines[b] = {k: m[k] for k in ("breakout_fail_rate", "sweeps_per_100_days", "gap_fade_rate")}
            except Exception:
                pass
    try:
        news = yahoo.get_news(ticker)
    except Exception:
        news = []
    me["recent"]["gaps"] = tag_headlines(me["recent"]["gaps"], news)
    return {
        "ticker": me, "baselines": baselines, "headlines": news,
        "rules": {"breakout": f"Close above prior {BREAKOUT_LOOKBACK}-day closing high; failed if any close back below it within {FAIL_WINDOW} sessions",
                  "sweep": f"Low breaks the prior {SWING_LOOKBACK}-day low but the close recovers above it",
                  "gap": f"Open gaps ≥{GAP_PCT:g}% vs prior close; faded if any close within {FADE_WINDOW} sessions crosses back through the prior close"},
        "window_years": 5,
    }
