"""Price-action panel: indicators, relative strength, 52-week-high anchoring, ATR stops."""
from __future__ import annotations

import pandas as pd

from app import indicators as ind
from app.clients import yahoo
from app.util import series_points

# yfinance sector name -> SPDR sector ETF (used for relative strength vs sector).
SECTOR_ETF = {
    "Technology": "XLK", "Healthcare": "XLV", "Financial Services": "XLF", "Consumer Cyclical": "XLY",
    "Consumer Defensive": "XLP", "Energy": "XLE", "Industrials": "XLI", "Basic Materials": "XLB",
    "Real Estate": "XLRE", "Utilities": "XLU", "Communication Services": "XLC",
}


def sector_etf(ticker: str) -> str | None:
    try:
        return SECTOR_ETF.get(yahoo.get_info(ticker).get("sector") or "")
    except Exception:
        return None


def relative_strength(close: pd.Series, bench: pd.Series, bars: int = 252) -> pd.Series:
    """Ratio of ticker to benchmark, rebased to 100 at the start of the window. Rising = outperforming."""
    joined = pd.concat([close, bench], axis=1, join="inner").dropna().iloc[-bars:]
    ratio = joined.iloc[:, 0] / joined.iloc[:, 1]
    return 100 * ratio / ratio.iloc[0]


def summary(df: pd.DataFrame) -> dict:
    close = df["Close"]
    last = float(close.iloc[-1])
    high52 = float(df["High"].iloc[-252:].max())
    ath = float(df["High"].max())
    atr14 = float(ind.atr(df).iloc[-1])
    return {
        "last": last,
        "pct_from_52w_high": (last / high52 - 1) * 100,
        "high52_to_ath": high52 / ath,
        "atr14": atr14,
        "atr_pct": atr14 / last * 100,
        "stops": [{"atr_mult": k, "price": last - k * atr14, "pct": -k * atr14 / last * 100} for k in (1.5, 2.0, 3.0)],
        "sma50": float(ind.sma(close, 50).iloc[-1]),
        "sma200": float(ind.sma(close, 200).iloc[-1]),
        "rsi14": float(ind.rsi(close, 14).iloc[-1]),
    }


def analyze(ticker: str) -> dict:
    df = yahoo.get_history(ticker)
    close = df["Close"]
    m = ind.macd(close)
    out = {
        "summary": summary(df),
        "rsi14": series_points(ind.rsi(close, 14), 2),
        "rsi2": series_points(ind.rsi(close, 2), 2),
        "macd": series_points(m["macd"]),
        "macd_signal": series_points(m["signal"]),
        "macd_hist": series_points(m["hist"]),
        "rs": {},
    }
    for label, bench in (("SPY", "SPY"), ("sector", sector_etf(ticker))):
        if not bench or bench == ticker:
            continue
        try:
            out["rs"][label] = {"etf": bench, "points": series_points(relative_strength(close, yahoo.get_history(bench)["Close"]), 2)}
        except Exception as e:
            out["rs"][label] = {"etf": bench, "error": str(e)}
    return out
