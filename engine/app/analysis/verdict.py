"""Scorecard components (0-100 each) with the reasons behind every point.

These are transparent rules of thumb, not a predictive model. Weights are applied in the UI
(editable in Settings); a component with no data is excluded and the rest re-weighted.
"""
from __future__ import annotations

from app.analysis import earnings, fundamentals, macro, technicals, valuation


def _score(rules: list[tuple[str, int, bool | None]]) -> dict:
    usable = [r for r in rules if r[2] is not None]
    if not usable:
        return {"score": None, "reasons": [{"text": r[0], "points": r[1], "met": None} for r in rules]}
    total = sum(p for _, p, _ in usable)
    got = sum(p for _, p, met in usable if met)
    return {"score": got / total * 100, "reasons": [{"text": t, "points": p, "met": m} for t, p, m in rules]}


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception:
        return None


def analyze(ticker: str) -> dict:
    comps = {}
    t = _safe(technicals.analyze, ticker)
    if t:
        s = t["summary"]
        rs = t["rs"].get("SPY", {}).get("points") or []
        rs_up = rs[-1]["value"] > rs[-64]["value"] if len(rs) > 64 else None
        comps["technicals"] = _score([
            ("Close above 200-day average", 25, s["last"] > s["sma200"]),
            ("50-day above 200-day average", 20, s["sma50"] > s["sma200"]),
            ("Close above 50-day average", 20, s["last"] > s["sma50"]),
            ("RSI(14) between 40 and 70 (not stretched)", 15, 40 <= s["rsi14"] <= 70),
            ("Outperformed SPY over ~3 months", 20, rs_up),
        ])
    e = _safe(earnings.analyze, ticker)
    if e:
        last = e["quarters"][-1] if e["quarters"] else {}
        sp = last.get("surprise_pct")
        comps["earnings"] = _score([
            ("Last EPS surprise positive", 40, None if sp is None else sp > 0),
            ("Market reacted up to last report", 30, None if last.get("ret_1d") is None else last["ret_1d"] > 0),
            ("No earnings inside a 2-week hold", 30, None if e["days_to_next"] is None else not e["inside_hold_window"]),
        ])
    r = _safe(macro.regime)
    comps["macro"] = {"score": {"Risk-On": 100, "Neutral": 50, "Risk-Off": 0}[r["label"]], "reasons": [{"text": f"Regime: {r['label']}", "points": 100, "met": r["label"] == "Risk-On"}]} if r else {"score": None, "reasons": [{"text": "Regime unavailable (needs FRED key)", "points": 0, "met": None}]}
    f = _safe(fundamentals.table, ticker, "quarterly")
    if f is not None and len(f) > 0:
        lag = 4 if len(f) > 4 else len(f) - 1
        now, then = f.iloc[-1], f.iloc[-1 - lag] if lag > 0 else None

        def cmp(col):
            if then is None or now[col] != now[col] or then[col] != then[col]:
                return None
            return bool(now[col] > then[col])

        comps["fundamentals"] = _score([
            (f"Revenue up vs {lag} quarter(s) earlier", 35, cmp("revenue")),
            ("Latest free cash flow positive", 35, None if now["fcf"] != now["fcf"] else bool(now["fcf"] > 0)),
            (f"Operating margin up vs {lag} quarter(s) earlier", 30, cmp("operating_margin")),
        ])
    v = _safe(valuation.analyze, ticker)
    if v:
        pcts = [m["percentile"] for m in v["metrics"].values() if m.get("available")]
        comps["valuation"] = {
            "score": 100 - sum(pcts) / len(pcts) if pcts else None,
            "reasons": [{"text": f"{m['label']} at {m['percentile']:.0f}th percentile of own history", "points": 0, "met": m["percentile"] < 50}
                        for m in v["metrics"].values() if m.get("available")],
        }
    return {"components": comps}
