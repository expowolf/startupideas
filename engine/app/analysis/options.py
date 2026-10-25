"""Current-day options snapshot: ATM IV term structure, skew, expected move into earnings.

No IV history / IV rank: there is no free source for it (cut on purpose).
"""
from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from app.analysis import earnings
from app.clients import yahoo

MIN_IV = 0.01  # Yahoo reports ~0 IV for stale/illiquid strikes


def _mid(row: pd.Series) -> float | None:
    if row["bid"] > 0 and row["ask"] > 0:
        return (row["bid"] + row["ask"]) / 2
    return row["lastPrice"] if row["lastPrice"] > 0 else None


def _atm(chain: dict, spot: float) -> tuple[float, pd.Series, pd.Series] | None:
    calls, puts = chain["calls"], chain["puts"]
    strikes = sorted(set(calls["strike"]) & set(puts["strike"]))
    if not strikes:
        return None
    k = min(strikes, key=lambda s: abs(s - spot))
    return k, calls[calls["strike"] == k].iloc[0], puts[puts["strike"] == k].iloc[0]


def is_monthly(d: date) -> bool:
    return d.weekday() == 4 and 15 <= d.day <= 21


def analyze(ticker: str, max_expiries: int = 10) -> dict:
    exps = yahoo.get_option_expirations(ticker)
    if not exps:
        return {"available": False, "reason": "No listed options for this ticker."}
    spot = float(yahoo.get_history(ticker)["Close"].iloc[-1])
    today = datetime.now().date()

    term = []
    for e in exps[:max_expiries]:
        atm = _atm(yahoo.get_option_chain(ticker, e), spot)
        if not atm:
            continue
        k, c, p = atm
        ivs = [v for v in (c["impliedVolatility"], p["impliedVolatility"]) if v and v > MIN_IV]
        if ivs:
            dte = (date.fromisoformat(e) - today).days
            term.append({"expiry": e, "dte": dte, "atm_iv": sum(ivs) / len(ivs) * 100, "strike": k})

    skew, skew_exp = [], next((e for e in exps if is_monthly(date.fromisoformat(e)) and (date.fromisoformat(e) - today).days >= 7), None)
    if skew_exp:
        ch = yahoo.get_option_chain(ticker, skew_exp)
        otm = pd.concat([ch["puts"][ch["puts"]["strike"] < spot].assign(side="put"), ch["calls"][ch["calls"]["strike"] >= spot].assign(side="call")])
        otm = otm[(otm["impliedVolatility"] > MIN_IV) & (otm["strike"].between(spot * 0.75, spot * 1.25))]
        skew = [{"strike": float(r.strike), "iv": float(r.impliedVolatility) * 100, "side": r.side, "moneyness": float(r.strike / spot)} for r in otm.sort_values("strike").itertuples()]

    move = None
    try:
        nxt = earnings.next_date(ticker)
    except Exception:
        nxt = None
    target = next((e for e in exps if nxt is not None and date.fromisoformat(e) >= nxt.date()), None)
    basis = "next earnings"
    if target is None:
        target, basis = exps[0], "nearest expiry (no upcoming earnings date found)"
    atm = _atm(yahoo.get_option_chain(ticker, target), spot)
    if atm:
        k, c, p = atm
        cm, pm = _mid(c), _mid(p)
        if cm and pm:
            straddle = cm + pm
            move = {"expiry": target, "basis": basis, "earnings_date": nxt.strftime("%Y-%m-%d") if nxt is not None else None,
                    "strike": k, "straddle": straddle, "move_pct": straddle / spot * 100,
                    "range": [spot - straddle, spot + straddle]}

    return {"available": True, "spot": spot, "term": term, "skew": skew, "skew_expiry": skew_exp, "expected_move": move,
            "note": "Snapshot of today's quotes. Outside market hours bid/ask can be zero and last prices stale."}
