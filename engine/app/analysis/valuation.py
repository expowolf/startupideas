"""P/E, EV/EBITDA, P/FCF versus the stock's own history (no peers in v1).

Fundamentals come from annual statements (yfinance returns ~4 fiscal years), each assumed
public 60 days after fiscal year end. Daily prices are split/dividend adjusted, so ratios
just before a stock split or for heavy dividend payers can be slightly off.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.analysis.fundamentals import _col
from app.clients import yahoo

FILING_LAG_DAYS = 60


def history(ticker: str, years: int = 5) -> pd.DataFrame:
    inc = yahoo.get_statement(ticker, "income", "annual")
    cf = yahoo.get_statement(ticker, "cashflow", "annual")
    bs = yahoo.get_statement(ticker, "balance", "annual")
    if inc.empty:
        return pd.DataFrame()
    f = pd.DataFrame(index=inc.index)
    f["eps"] = _col(inc, "Diluted EPS", "Basic EPS")
    f["shares"] = _col(inc, "Diluted Average Shares", "Basic Average Shares")
    f["ebitda"] = _col(inc, "EBITDA", "Normalized EBITDA")
    f["fcf"] = _col(cf, "Free Cash Flow").reindex(f.index)
    f["debt"] = _col(bs, "Total Debt").reindex(f.index)
    f["cash"] = _col(bs, "Cash And Cash Equivalents").reindex(f.index)
    f.index = f.index + pd.Timedelta(days=FILING_LAG_DAYS)  # when the numbers became public

    px = yahoo.get_history(ticker)["Close"]
    px = px[px.index >= px.index[-1] - pd.DateOffset(years=years)]
    known = f.reindex(px.index, method="ffill")  # only fundamentals already public on each day
    mcap = px * known["shares"]
    ev = mcap + known["debt"].fillna(0) - known["cash"].fillna(0)
    out = pd.DataFrame({
        "pe": (px / known["eps"]).where(known["eps"] > 0),
        "ev_ebitda": (ev / known["ebitda"]).where(known["ebitda"] > 0),
        "p_fcf": (mcap / known["fcf"]).where(known["fcf"] > 0),
    }, index=px.index)
    return out.dropna(how="all")


def analyze(ticker: str) -> dict:
    h = history(ticker)
    metrics = {}
    for col, label in (("pe", "P/E"), ("ev_ebitda", "EV/EBITDA"), ("p_fcf", "P/FCF")):
        s = h[col].dropna() if col in h else pd.Series(dtype=float)
        if len(s) < 60:
            metrics[col] = {"label": label, "available": False}
            continue
        cur = float(s.iloc[-1])
        q = np.percentile(s, [10, 25, 50, 75, 90])
        weekly = s.iloc[::5]
        metrics[col] = {
            "label": label,
            "available": True,
            "current": cur,
            "percentile": float((s < cur).mean() * 100),
            "bands": dict(zip(["p10", "p25", "p50", "p75", "p90"], map(float, q))),
            "points": [{"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 2)} for d, v in weekly.items()],
            "since": s.index[0].strftime("%Y-%m-%d"),
        }
    return {"metrics": metrics, "note": __doc__.strip().split("\n\n")[1].replace("\n", " ")}
