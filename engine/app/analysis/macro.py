"""Macro panel (FRED) and the market regime badge.

REGIME RULE (fixed in advance, not tuned on history):
  stress points = [SPY close < its 200-day average] + [VIX close > 25]
  0 points and VIX < 20  -> Risk-On
  2 points               -> Risk-Off
  anything else          -> Neutral
The same rule is evaluated day by day for the backtest regime filter (S4), so the badge
and the backtests always mean the same thing. High-yield spreads are shown for context
but left out of the rule because FRED only serves ~3 years of that series.
"""
from __future__ import annotations

import pandas as pd

from app import indicators as ind
from app.clients import fred, yahoo
from app.util import series_points

VIX_STRESS, VIX_CALM = 25.0, 20.0
CURVE = [("3M", "DGS3MO"), ("1Y", "DGS1"), ("2Y", "DGS2"), ("5Y", "DGS5"), ("10Y", "DGS10"), ("30Y", "DGS30")]


def regime_series(spy_close: pd.Series, vix: pd.Series) -> pd.Series:
    """Daily regime label on SPY's trading days. VIX is forward-filled (only past values)."""
    v = vix.reindex(spy_close.index, method="ffill")
    below = spy_close < ind.sma(spy_close, 200)
    points = below.astype(int) + (v > VIX_STRESS).astype(int)
    lab = pd.Series("Neutral", index=spy_close.index)
    lab[(points == 0) & (v < VIX_CALM)] = "Risk-On"
    lab[points == 2] = "Risk-Off"
    lab[v.isna() | ind.sma(spy_close, 200).isna()] = None
    return lab


def regime() -> dict:
    spy = yahoo.get_history("SPY")["Close"]
    vix = fred.get_series("VIXCLS")["value"]
    sma200 = float(ind.sma(spy, 200).iloc[-1])
    v = float(vix.iloc[-1])
    label = regime_series(spy, vix).dropna().iloc[-1]
    return {
        "label": label,
        "asof": spy.index[-1].strftime("%Y-%m-%d"),
        "rules": [
            {"name": "SPY below 200-day average", "value": float(spy.iloc[-1]), "threshold": sma200, "triggered": bool(spy.iloc[-1] < sma200)},
            {"name": f"VIX above {VIX_STRESS:g}", "value": v, "threshold": VIX_STRESS, "triggered": v > VIX_STRESS},
        ],
        "definition": __doc__.split("REGIME RULE")[1].split("The same rule")[0].strip(),
    }


def _last(df: pd.DataFrame) -> dict | None:
    s = df["value"].dropna()
    return {"date": s.index[-1].strftime("%Y-%m-%d"), "value": float(s.iloc[-1])} if len(s) else None


def analyze(years: int = 10) -> dict:
    data, missing = {}, []
    for sid in fred.CANDIDATE_SERIES:
        try:
            data[sid] = fred.get_series(sid)
        except Exception as e:
            missing.append({"id": sid, "error": str(e)})
    start = pd.Timestamp.now() - pd.DateOffset(years=years)

    def pts(s: pd.Series):
        return series_points(s[s.index >= start], 3)

    out = {"missing": missing, "series": {}, "curve": None}
    if all(sid in data for _, sid in CURVE):
        now = [{"tenor": t, "value": _last(data[sid])["value"]} for t, sid in CURVE]
        year_ago = []
        for t, sid in CURVE:
            s = data[sid]["value"].dropna()
            prior = s[s.index <= s.index[-1] - pd.DateOffset(years=1)]
            year_ago.append({"tenor": t, "value": float(prior.iloc[-1]) if len(prior) else None})
        out["curve"] = {"now": now, "year_ago": year_ago, "asof": _last(data["DGS10"])["date"]}
    for sid in ("T10Y2Y", "T10Y3M", "DFF", "UNRATE", "ICSA", "BAMLH0A0HYM2", "VIXCLS"):
        if sid in data:
            out["series"][sid] = {"points": pts(data[sid]["value"]), "last": _last(data[sid])}
    for sid, key in (("CPIAUCSL", "CPI_YOY"), ("CPILFESL", "CORE_CPI_YOY")):
        if sid in data:
            yoy = data[sid]["value"].pct_change(12) * 100
            out["series"][key] = {"points": pts(yoy), "last": _last(yoy.to_frame("value"))}
    return out
