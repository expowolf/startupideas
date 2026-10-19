"""yfinance wrapper: every call goes through the SQLite cache and backoff."""
from __future__ import annotations

import pandas as pd
import yfinance as yf

from app.backoff import with_backoff
from app.db import get_cached, put_cached

PRICE_TTL = 12 * 3600
EARNINGS_TTL = 24 * 3600
OHLCV = ["Open", "High", "Low", "Close", "Volume"]


def _cached(key: str, ttl: float, fetch):
    hit = get_cached(key, ttl)
    if hit is not None:
        return hit
    value = with_backoff(fetch)
    put_cached(key, value)
    return value


def get_history(ticker: str, period: str = "max") -> pd.DataFrame:
    """Daily OHLCV, split/dividend adjusted (auto_adjust=True).

    Adjusted prices matter for backtests: unadjusted data shows fake gaps on split days.
    """

    def fetch() -> pd.DataFrame:
        df = yf.Ticker(ticker).history(period=period, interval="1d", auto_adjust=True)
        if df.empty:
            raise ValueError(f"No price data for {ticker}")
        df = df[OHLCV].copy()
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        df.index.name = "Date"
        return df

    return _cached(f"hist:{ticker}:{period}", PRICE_TTL, fetch)


def get_earnings_dates(ticker: str, limit: int = 40) -> pd.DataFrame:
    """Earnings dates with EPS estimate, reported EPS and surprise %. Coverage varies by ticker."""

    def fetch() -> pd.DataFrame:
        df = yf.Ticker(ticker).get_earnings_dates(limit=limit)
        if df is None or df.empty:
            return pd.DataFrame(columns=["EPS Estimate", "Reported EPS", "Surprise(%)"])
        df.index = pd.to_datetime(df.index).tz_localize(None)
        df.index.name = "Date"
        return df

    return _cached(f"earn:{ticker}:{limit}", EARNINGS_TTL, fetch)


def get_option_expirations(ticker: str) -> list[str]:
    return _cached(
        f"optexp:{ticker}", PRICE_TTL, lambda: list(yf.Ticker(ticker).options)
    )


def get_quarterly_income(ticker: str) -> pd.DataFrame:
    return _cached(
        f"qinc:{ticker}", EARNINGS_TTL, lambda: yf.Ticker(ticker).quarterly_income_stmt
    )
