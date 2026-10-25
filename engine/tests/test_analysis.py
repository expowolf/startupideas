"""Every analysis endpoint run end-to-end against fake yfinance/FRED data (no network)."""
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.clients import fred, yahoo
from tests.conftest import make_bars

TODAY = pd.Timestamp(datetime.now().date())


@pytest.fixture
def fake(monkeypatch):
    end = TODAY - pd.offsets.BDay(1)
    hist = {t: make_bars(1500, seed=s, start=str((end - pd.offsets.BDay(1499)).date())) for s, t in enumerate(["AAA", "SPY", "XLK"], 1)}
    monkeypatch.setattr(yahoo, "get_history", lambda t, period="max": hist[t])
    monkeypatch.setattr(yahoo, "get_info", lambda t: {"sector": "Technology", "marketCap": 5e9, "shortName": t})

    dates = list(hist["AAA"].index[200::63])
    rows = {d + pd.Timedelta(hours=16): {"EPS Estimate": 1.0, "Reported EPS": 1.1 if k % 2 else 0.9, "Surprise(%)": 10.0 if k % 2 else -10.0} for k, d in enumerate(dates)}
    rows[TODAY + pd.Timedelta(days=10, hours=16)] = {"EPS Estimate": 1.2, "Reported EPS": np.nan, "Surprise(%)": np.nan}
    earn = pd.DataFrame.from_dict(rows, orient="index")
    monkeypatch.setattr(yahoo, "get_earnings_dates", lambda t, limit=40: earn)

    q = pd.date_range(end=TODAY, periods=8, freq="QE")
    a = pd.date_range(end=TODAY, periods=4, freq="YE")

    def stmt(t, kind, freq="quarterly"):
        idx = q if freq == "quarterly" else a
        n = len(idx)
        if kind == "income":
            return pd.DataFrame({"Total Revenue": np.linspace(100, 140, n), "Gross Profit": np.linspace(40, 50, n), "Operating Income": np.linspace(20, 18, n),
                                 "Diluted EPS": np.linspace(2, 3, n), "Diluted Average Shares": [1e6] * n, "EBITDA": np.linspace(30, 40, n)}, index=idx)
        if kind == "cashflow":
            return pd.DataFrame({"Free Cash Flow": np.linspace(20, 10, n)}, index=idx)
        return pd.DataFrame({"Total Debt": [50.0] * n, "Cash And Cash Equivalents": [20.0] * n}, index=idx)

    monkeypatch.setattr(yahoo, "get_statement", stmt)
    exps = [(TODAY + timedelta(days=d)).strftime("%Y-%m-%d") for d in (3, 17, 31, 66)]
    third_fri = pd.date_range(TODAY + timedelta(days=8), periods=60, freq="D")
    exps.append(next(d for d in third_fri if d.weekday() == 4 and 15 <= d.day <= 21).strftime("%Y-%m-%d"))
    exps.sort()
    monkeypatch.setattr(yahoo, "get_option_expirations", lambda t: exps)
    spot = hist["AAA"]["Close"].iloc[-1]

    def chain(t, e):
        k = np.round(np.linspace(spot * 0.7, spot * 1.3, 25), 1)
        iv = 0.3 + 0.2 * np.abs(k / spot - 1)
        side = pd.DataFrame({"strike": k, "lastPrice": 2.0, "bid": 1.9, "ask": 2.1, "impliedVolatility": iv, "volume": 10, "openInterest": 100})
        return {"calls": side, "puts": side.copy()}

    monkeypatch.setattr(yahoo, "get_option_chain", chain)
    monkeypatch.setattr(yahoo, "get_news", lambda t: [{"title": "Big news", "published": str(hist["AAA"].index[-3].date()) + "T12:00:00", "publisher": "X", "url": "u"}])

    fidx = pd.bdate_range(end=end, periods=3000)
    rng = np.random.default_rng(3)

    def series(sid):
        if sid in ("CPIAUCSL", "CPILFESL", "UNRATE"):
            idx = pd.date_range(end=TODAY, periods=200, freq="MS")
            return pd.DataFrame({"value": np.linspace(200, 300, 200)}, index=idx)
        base = 18 if sid == "VIXCLS" else 3
        return pd.DataFrame({"value": base + rng.normal(0, 1, len(fidx)).cumsum() * 0.05}, index=fidx)

    monkeypatch.setattr(fred, "get_series", series)
    from app.main import app
    return TestClient(app)


@pytest.mark.parametrize("path", ["technicals", "earnings", "fundamentals", "valuation", "options", "sentiment", "traps", "verdict"])
def test_ticker_endpoints(fake, path):
    r = fake.get(f"/api/{path}/AAA")
    assert r.status_code == 200, r.text


def test_earnings_logic(fake):
    e = fake.get("/api/earnings/AAA").json()
    assert e["inside_hold_window"] is True and e["days_to_next"] == 10
    assert e["coverage"]["with_estimate"] == len(e["quarters"]) > 5


def test_fundamental_divergence_flagged(fake):
    f = fake.get("/api/fundamentals/AAA").json()
    keys = {d["key"] for d in f["divergences"]}
    assert {"rev_up_fcf_down", "rev_up_margin_down"} <= keys


def test_options_shape(fake):
    o = fake.get("/api/options/AAA").json()
    assert o["term"] and o["skew"] and o["expected_move"]["move_pct"] > 0


def test_macro_and_regime(fake):
    m = fake.get("/api/macro").json()
    assert m["curve"] and "CPI_YOY" in m["series"]
    r = fake.get("/api/regime").json()
    assert r["label"] in {"Risk-On", "Neutral", "Risk-Off"} and len(r["rules"]) == 2


def test_verdict_components(fake):
    v = fake.get("/api/verdict/AAA").json()["components"]
    assert set(v) == {"technicals", "earnings", "macro", "fundamentals", "valuation"}


@pytest.mark.parametrize("body", [
    {"strategy": "S2", "tickers": ["AAA"]},
    {"strategy": "S3", "tickers": ["AAA", "XLK"], "regime": "compare"},
    {"strategy": "S1", "tickers": ["AAA"]},
    {"strategy": "S2", "tickers": ["AAA"], "walk_forward": True, "grid": {"rsi_threshold": [5, 10]}},
])
def test_backtest_runs(fake, body):
    r = fake.post("/api/backtest", json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["verdict"]["status"] in {"insufficient_sample", "data_mining_risk", "passes_hurdle"}
    assert any("Survivorship" in w for w in j["warnings"])
    assert j["variants_tried"] >= 1


def test_variant_counter_counts_distinct(fake):
    for t in (5, 10, 10):
        fake.post("/api/backtest", json={"strategy": "S2", "tickers": ["AAA"], "params": {"rsi_threshold": t}})
    assert fake.get("/api/backtest/variants").json()["S2"] == 2


def test_backtest_csv(fake):
    df = make_bars(600)
    csv = df.reset_index().to_csv(index=False)
    r = fake.post("/api/backtest", json={"strategy": "S2", "csv": csv})
    assert r.status_code == 200, r.text
    assert fake.post("/api/backtest", json={"strategy": "S1", "csv": csv}).status_code == 400
    assert fake.post("/api/backtest", json={"strategy": "S2", "csv": "a,b\n1,2"}).status_code == 400


def test_journal_roundtrip_and_analytics(fake):
    base = {"ticker": "AAA", "entry_date": "2026-01-05", "entry": 100, "stop": 95, "size": 10, "setup": "pullback", "emotion": "calm", "followed_plan": True}
    a = fake.post("/api/journal", json={**base, "exit": 110, "exit_date": "2026-01-08"}).json()["id"]
    fake.post("/api/journal", json={**base, "emotion": "FOMO", "followed_plan": False, "exit": 90, "exit_date": "2026-01-20"})
    rows = fake.get("/api/journal").json()
    win = next(r for r in rows if r["id"] == a)
    assert win["r_multiple"] == pytest.approx(2.0) and win["pnl"] == pytest.approx(100) and win["hold_days"] == 3
    an = fake.get("/api/journal/analytics").json()
    assert an["n_closed"] == 2 and an["win_rate"] == 50 and an["disposition_flag"] is True
    assert fake.put(f"/api/journal/{a}", json={**base, "note": "edited"}).status_code == 200
    assert fake.delete(f"/api/journal/{a}").status_code == 200
    assert fake.post("/api/journal", json={**base, "emotion": "greedy"}).status_code == 422


def test_earnings_for_a_fund_is_empty_not_an_error(fake, monkeypatch):
    # yfinance returns an empty frame for ETFs; after the SQLite cache round-trip its index is not datetime.
    empty = pd.DataFrame(columns=["EPS Estimate", "Reported EPS", "Surprise(%)"])
    monkeypatch.setattr(yahoo, "get_earnings_dates", lambda t, limit=40: empty)
    r = fake.get("/api/earnings/SPY")
    assert r.status_code == 200, r.text
    assert r.json()["quarters"] == [] and r.json()["next_date"] is None
