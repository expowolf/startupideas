"""Data coverage check. Run from /engine:  python -m scripts.validate [TICKER ...]

Prints what yfinance and FRED actually return, so we build panels on real coverage,
not assumptions. Default tickers: AAPL, MSFT, and a small-cap (AMSF, ~$1B cap).
"""
from __future__ import annotations

import sys

from dotenv import load_dotenv

load_dotenv()

from app.clients import fred, yahoo  # noqa: E402

DEFAULT_TICKERS = ["AAPL", "MSFT", "AMSF"]


def check_ticker(t: str) -> None:
    print(f"\n=== {t} ===")
    try:
        h = yahoo.get_history(t)
        print(f"  prices     {len(h):>6} bars  {h.index[0].date()} -> {h.index[-1].date()}")
    except Exception as e:
        print(f"  prices     FAILED: {e}")

    try:
        e = yahoo.get_earnings_dates(t)
        past = e[e["Reported EPS"].notna()]
        with_est = past[past["EPS Estimate"].notna()]
        span = f"{past.index.min().date()} -> {past.index.max().date()}" if len(past) else "n/a"
        print(f"  earnings   {len(past):>6} reported quarters ({span})")
        print(f"             {len(with_est):>6} with an EPS estimate (usable for surprise/PEAD)")
        upcoming = e[e["Reported EPS"].isna()]
        if len(upcoming):
            print(f"             next date: {upcoming.index.min().date()}")
    except Exception as e:
        print(f"  earnings   FAILED: {e}")

    try:
        print(f"  options    {len(yahoo.get_option_expirations(t)):>6} expirations")
    except Exception as e:
        print(f"  options    FAILED: {e}")

    try:
        print(f"  financials {yahoo.get_quarterly_income(t).shape[1]:>6} quarters of income statement")
    except Exception as e:
        print(f"  financials FAILED: {e}")


def check_fred() -> None:
    print("\n=== FRED ===")
    for sid in fred.CANDIDATE_SERIES:
        try:
            info = fred.get_series_info(sid)
            verdict = "DROP (stale)" if fred.is_stale(info) else "KEEP"
            print(f"  {sid:<14} {info['frequency']}  last {info['last_observation']}  {verdict}  {info['title'][:50]}")
        except Exception as e:
            print(f"  {sid:<14} DROP (error: {e})")


if __name__ == "__main__":
    for t in sys.argv[1:] or DEFAULT_TICKERS:
        check_ticker(t.upper())
    check_fred()
