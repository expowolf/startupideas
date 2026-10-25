"""Swing Desk engine. Run: uvicorn app.main:app --reload --port 8000 (from /engine)."""
from __future__ import annotations

import os
import re

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app import journal  # noqa: E402  (env must load first)
from app.analysis import earnings, fundamentals, macro, options, sentiment, technicals, traps, valuation, verdict  # noqa: E402
from app.backtest import runner  # noqa: E402
from app.clients import fred, yahoo  # noqa: E402
from app.util import clean  # noqa: E402

app = FastAPI(title="Swing Desk Engine")
app.add_middleware(
    CORSMiddleware,
    # Add your Vercel URL here (comma-separated) when the UI is deployed there.
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

TICKER_RE = re.compile(r"^[A-Z0-9.\-^=]{1,12}$")


def _ticker(raw: str) -> str:
    t = raw.upper()
    if not TICKER_RE.match(t):
        raise HTTPException(400, f"Invalid ticker: {raw}")
    return t


def _records(df):
    out = df.reset_index()
    out["Date"] = out["Date"].dt.strftime("%Y-%m-%d")
    return out.to_dict(orient="records")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/prices/{ticker}")
def get_prices(ticker: str):
    t = _ticker(ticker)
    try:
        df = yahoo.get_history(t)
    except Exception as e:
        raise HTTPException(502, f"Price fetch failed for {t}: {e}")
    return {"ticker": t, "bars": _records(df)}


@app.get("/api/macro/{series_id}")
def macro_series(series_id: str):
    sid = series_id.upper()
    if sid not in fred.CANDIDATE_SERIES:
        raise HTTPException(404, f"Unknown series: {sid}")
    try:
        df = fred.get_series(sid)
    except Exception as e:
        raise HTTPException(502, f"FRED fetch failed for {sid}: {e}")
    return {"id": sid, "points": _records(df)}


def _run(fn, *args):
    """Call an analysis function; upstream/data errors become a 502 with the reason."""
    try:
        return clean(fn(*args))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"{type(e).__name__}: {e}")


@app.get("/api/technicals/{ticker}")
def get_technicals(ticker: str):
    return _run(technicals.analyze, _ticker(ticker))


@app.get("/api/earnings/{ticker}")
def get_earnings(ticker: str):
    return _run(earnings.analyze, _ticker(ticker))


@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str, freq: str = "quarterly"):
    if freq not in ("quarterly", "annual"):
        raise HTTPException(400, "freq must be quarterly or annual")
    return _run(fundamentals.analyze, _ticker(ticker), freq)


@app.get("/api/valuation/{ticker}")
def get_valuation(ticker: str):
    return _run(valuation.analyze, _ticker(ticker))


@app.get("/api/options/{ticker}")
def get_options(ticker: str):
    return _run(options.analyze, _ticker(ticker))


@app.get("/api/sentiment/{ticker}")
def get_sentiment(ticker: str):
    return _run(sentiment.analyze, _ticker(ticker))


@app.get("/api/traps/{ticker}")
def get_traps(ticker: str):
    return _run(traps.analyze, _ticker(ticker))


@app.get("/api/verdict/{ticker}")
def get_verdict(ticker: str):
    return _run(verdict.analyze, _ticker(ticker))


@app.get("/api/macro")
def get_macro():
    return _run(macro.analyze)


@app.get("/api/regime")
def get_regime():
    return _run(macro.regime)


@app.get("/api/journal")
def journal_list():
    return clean(journal.list_trades())


@app.post("/api/journal")
def journal_create(t: journal.Trade):
    return {"id": journal.create(t)}


@app.put("/api/journal/{trade_id}")
def journal_update(trade_id: int, t: journal.Trade):
    if not journal.update(trade_id, t):
        raise HTTPException(404, "No such trade")
    return {"ok": True}


@app.delete("/api/journal/{trade_id}")
def journal_delete(trade_id: int):
    if not journal.delete(trade_id):
        raise HTTPException(404, "No such trade")
    return {"ok": True}


@app.get("/api/journal/analytics")
def journal_analytics():
    return clean(journal.analytics())


@app.post("/api/backtest")
def backtest(req: runner.BacktestRequest):
    try:
        return clean(runner.run_request(req))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"{type(e).__name__}: {e}")


@app.get("/api/backtest/variants")
def backtest_variants():
    return runner.variant_counts()
