"""Revenue, margins, free cash flow, net debt, plus automatic divergence flags."""
from __future__ import annotations

import pandas as pd

from app.clients import yahoo


def _col(df: pd.DataFrame, *names: str) -> pd.Series:
    for n in names:
        if n in df.columns:
            return df[n]
    return pd.Series(index=df.index, dtype=float)


def table(ticker: str, freq: str) -> pd.DataFrame:
    inc = yahoo.get_statement(ticker, "income", freq)
    cf = yahoo.get_statement(ticker, "cashflow", freq)
    bs = yahoo.get_statement(ticker, "balance", freq)
    if inc.empty:
        return pd.DataFrame()
    rev = _col(inc, "Total Revenue", "Operating Revenue")
    out = pd.DataFrame(index=inc.index)
    out["revenue"] = rev
    out["gross_margin"] = _col(inc, "Gross Profit") / rev * 100
    out["operating_margin"] = _col(inc, "Operating Income") / rev * 100
    fcf = _col(cf, "Free Cash Flow")
    if fcf.isna().all():
        fcf = _col(cf, "Operating Cash Flow") + _col(cf, "Capital Expenditure")
    out["fcf"] = fcf.reindex(out.index)
    nd = _col(bs, "Net Debt")
    if nd.isna().all():
        nd = _col(bs, "Total Debt") - _col(bs, "Cash And Cash Equivalents")
    out["net_debt"] = nd.reindex(out.index)
    return out.dropna(how="all", subset=["revenue"])


EXPLAIN = {
    "rev_up_fcf_down": (
        "Revenue grew while free cash flow fell.",
        ["Investing for growth (capex, inventory build) ahead of demand", "Timing of payments or tax"],
        ["Growth is being bought with discounts or looser credit terms", "Rising working capital: customers paying slower"],
    ),
    "rev_up_margin_down": (
        "Revenue grew while operating margin fell.",
        ["Deliberate spending on R&D or expansion", "New, lower-margin product ramping"],
        ["Losing pricing power", "Costs growing faster than sales"],
    ),
    "rev_down_debt_up": (
        "Revenue fell while net debt rose.",
        ["Debt-funded acquisition not yet in revenue", "Buybacks financed with cheap debt"],
        ["Borrowing to cover a shrinking business"],
    ),
}


def divergences(t: pd.DataFrame, freq: str) -> list[dict]:
    lag = 4 if freq == "quarterly" else 1  # compare with the same quarter a year earlier
    if len(t) <= lag:
        return []
    now, then = t.iloc[-1], t.iloc[-1 - lag]
    flags = []

    def up(c):
        return pd.notna(now[c]) and pd.notna(then[c]) and now[c] > then[c]

    def down(c):
        return pd.notna(now[c]) and pd.notna(then[c]) and now[c] < then[c]

    checks = {
        "rev_up_fcf_down": up("revenue") and down("fcf"),
        "rev_up_margin_down": up("revenue") and down("operating_margin"),
        "rev_down_debt_up": down("revenue") and up("net_debt"),
    }
    for key, hit in checks.items():
        if hit:
            text, good, bad = EXPLAIN[key]
            flags.append({"key": key, "text": text, "good": good, "bad": bad})
    return flags


def analyze(ticker: str, freq: str = "quarterly") -> dict:
    t = table(ticker, freq)
    rows = [{"date": d.strftime("%Y-%m-%d"), **r} for d, r in t.to_dict(orient="index").items()]
    return {"freq": freq, "periods": rows, "divergences": divergences(t, freq)}
