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


INFO_TTL = 24 * 3600
STATEMENT_ROWS = {
    "income": ("income_stmt", "quarterly_income_stmt"),
    "cashflow": ("cashflow", "quarterly_cashflow"),
    "balance": ("balance_sheet", "quarterly_balance_sheet"),
}


def get_info(ticker: str) -> dict:
    """Subset of .info we use. Note marketCap is today's value (not point-in-time)."""

    def fetch() -> dict:
        i = yf.Ticker(ticker).info or {}
        keys = ["shortName", "sector", "industry", "marketCap", "currency", "quoteType"]
        return {k: i.get(k) for k in keys}

    return _cached(f"info:{ticker}", INFO_TTL, fetch)


def get_statement(ticker: str, kind: str, freq: str = "quarterly") -> pd.DataFrame:
    """Financial statement with one row per period (oldest first) and line items as columns."""
    annual_attr, quarterly_attr = STATEMENT_ROWS[kind]
    attr = quarterly_attr if freq == "quarterly" else annual_attr

    def fetch() -> pd.DataFrame:
        raw = getattr(yf.Ticker(ticker), attr)
        if raw is None or raw.empty:
            return pd.DataFrame()
        df = raw.T.sort_index()
        df.index = pd.to_datetime(df.index)
        df.index.name = "Date"
        return df.apply(pd.to_numeric, errors="coerce")

    return _cached(f"stmt:{ticker}:{kind}:{freq}", EARNINGS_TTL, fetch)


def get_option_chain(ticker: str, expiry: str) -> dict:
    """{'calls': DataFrame, 'puts': DataFrame} for one expiry. Cached 1h (current-day data only)."""

    def fetch() -> dict:
        ch = yf.Ticker(ticker).option_chain(expiry)
        cols = ["strike", "lastPrice", "bid", "ask", "impliedVolatility", "volume", "openInterest"]
        return {side: getattr(ch, side)[cols].to_dict(orient="list") for side in ("calls", "puts")}

    raw = _cached(f"chain:{ticker}:{expiry}", 3600, fetch)
    return {k: pd.DataFrame(v) for k, v in raw.items()}


def get_news(ticker: str) -> list[dict]:
    """Recent headlines (Yahoo returns only the latest ~10-20). Normalizes old and new yfinance formats."""

    def fetch() -> list[dict]:
        out = []
        for item in yf.Ticker(ticker).news or []:
            c = item.get("content") or item
            title = c.get("title")
            when = c.get("pubDate") or c.get("providerPublishTime")
            if isinstance(when, (int, float)):
                when = pd.Timestamp(when, unit="s").isoformat()
            provider = (c.get("provider") or {}).get("displayName") or c.get("publisher")
            url = (c.get("canonicalUrl") or {}).get("url") or c.get("link")
            if title and when:
                out.append({"title": title, "published": str(when)[:19], "publisher": provider, "url": url})
        return out

    return _cached(f"news:{ticker}", 3600, fetch)
