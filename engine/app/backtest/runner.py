"""Backtest lab orchestration: data, IS/OOS split, walk-forward, variant counter, honesty warnings."""
from __future__ import annotations

import hashlib
import io
import itertools
import json
from dataclasses import asdict
from typing import Literal

import pandas as pd
from pydantic import BaseModel, Field

from app.analysis import earnings as earn
from app.analysis import macro
from app.backtest.engine import ExecParams, Strategy, buy_and_hold, metrics, run
from app.backtest.strategies import PEAD, Breakout52, RegimeFilter, Reversal
from app.clients import fred, yahoo
from app.db import connect

MIN_OOS_TRADES = 30
T_HURDLE = 3.0  # Harvey, Liu & Zhu (2016)
MAX_GRID = 60

DEFAULT_EXEC = {
    "S1": {"stop_atr": 2.0, "max_hold": 10},
    "S2": {"stop_atr": 2.5, "max_hold": 5},
    "S3": {"stop_atr": 2.0, "trail_atr": 3.0, "max_hold": 20},
}

SURVIVORSHIP = ("Survivorship bias: yfinance only has companies that still exist today. Delisted and bankrupt "
                "stocks are missing, so tests on a current universe overstate returns.")


class BacktestRequest(BaseModel):
    strategy: Literal["S1", "S2", "S3"]
    params: dict = {}
    exec: dict = {}
    tickers: list[str] = Field(default_factory=list, max_length=40)
    csv: str | None = None
    oos_frac: float = Field(0.3, ge=0.1, le=0.5)
    regime: Literal["off", "on", "compare"] = "off"  # S4 overlay
    walk_forward: bool = False
    grid: dict[str, list] | None = None


def parse_csv(text: str) -> pd.DataFrame:
    df = pd.read_csv(io.StringIO(text))
    df.columns = [c.strip().lower() for c in df.columns]
    need = ["date", "open", "high", "low", "close", "volume"]
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing columns: {', '.join(missing)} (need Date, Open, High, Low, Close, Volume)")
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()[need[1:]].apply(pd.to_numeric, errors="coerce").dropna()
    df.columns = ["Open", "High", "Low", "Close", "Volume"]
    df.index.name = "Date"
    if len(df) < 300:
        raise ValueError("CSV needs at least 300 daily bars (indicators like the 200-day average need warm-up).")
    return df


def _variants_conn():
    conn = connect()
    conn.execute("CREATE TABLE IF NOT EXISTS variants (strategy TEXT, hash TEXT, params TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (strategy, hash))")
    return conn


def log_variant(strategy: str, params: dict) -> None:
    blob = json.dumps(params, sort_keys=True, default=str)
    h = hashlib.sha1(blob.encode()).hexdigest()[:16]
    with _variants_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO variants (strategy, hash, params) VALUES (?, ?, ?)", (strategy, h, blob))


def variant_count(strategy: str) -> int:
    with _variants_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM variants WHERE strategy = ?", (strategy,)).fetchone()[0]


def variant_counts() -> dict:
    with _variants_conn() as conn:
        return dict(conn.execute("SELECT strategy, COUNT(*) FROM variants GROUP BY strategy").fetchall())


def _make(key: str, params: dict, ticker: str, df: pd.DataFrame) -> Strategy:
    if key == "S1":
        ev = earn.events(ticker, df, limit=60)
        if ev.empty:
            raise ValueError(f"{ticker}: no earnings history with EPS from yfinance")
        return PEAD(ev, **params)
    return {"S2": Reversal, "S3": Breakout52}[key](**params)


def cap_bucket(ticker: str) -> str:
    try:
        cap = yahoo.get_info(ticker).get("marketCap") or 0
    except Exception:
        cap = 0
    if not cap:
        return "unknown"
    return "small (<$2B)" if cap < 2e9 else ("mid ($2-10B)" if cap < 1e10 else "large (>$10B)")


def _pool_equity(curves: list[pd.Series]) -> pd.Series | None:
    curves = [c for c in curves if len(c)]
    if not curves:
        return None
    df = pd.concat(curves, axis=1).sort_index().ffill().fillna(1.0)
    return df.mean(axis=1)


def _weekly(eq: pd.Series | None) -> list[dict]:
    if eq is None:
        return []
    w = eq.iloc[::5]
    return [{"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 4)} for d, v in w.items()]


def _breakdown(trades, key) -> list[dict]:
    groups: dict[str, list] = {}
    for t in trades:
        groups.setdefault(t.tags.get(key, "unknown"), []).append(t)
    return [{"key": k, **metrics(v, None)} for k, v in sorted(groups.items())]


def _verdict(m: dict, n_variants: int) -> dict:
    if (m.get("trades") or 0) < MIN_OOS_TRADES:
        return {"status": "insufficient_sample", "text": f"Insufficient sample: {m.get('trades', 0)} out-of-sample trades (need {MIN_OOS_TRADES})."}
    t = m.get("t_stat")
    if t is None or t < T_HURDLE:
        return {"status": "data_mining_risk", "text": f"t-stat {t:.2f} is below {T_HURDLE}: not distinguishable from data mining." if t is not None else "t-stat unavailable."}
    return {"status": "passes_hurdle", "text": f"t-stat {t:.2f} clears the {T_HURDLE} hurdle out of sample (after {n_variants} variants tried)."}


def _simulate(key, params, ex, data, regime_series, regime_mode, frac_from, frac_to, tag_ctx):
    """Run on each ticker's bars in [frac_from, frac_to) of its history. Returns trades and pooled equity."""
    trades, curves = [], []
    for ticker, df in data.items():
        strat = _make(key, params, ticker, df)
        if regime_mode == "on":
            strat = RegimeFilter(strat, regime_series)
        sig = strat.signals(df)
        a, b = int(len(df) * frac_from), int(len(df) * frac_to)
        tr, eq = run(df, strat, ex, a, b, ticker=ticker, sig=sig)
        for t in tr:
            t.tags = {k: fn(ticker, t) for k, fn in tag_ctx.items()}
        trades += tr
        curves.append(eq)
    return trades, _pool_equity(curves)


def run_request(req: BacktestRequest) -> dict:
    key = req.strategy
    if req.csv:
        if key == "S1":
            raise ValueError("S1 needs earnings history, which an uploaded CSV does not have. Use tickers instead.")
        data = {"CSV": parse_csv(req.csv)}
    else:
        if not req.tickers:
            raise ValueError("Give at least one ticker or upload a CSV.")
        data = {t.upper(): yahoo.get_history(t.upper()) for t in req.tickers}

    ex = ExecParams(**{**DEFAULT_EXEC[key], **req.exec})
    warnings = [SURVIVORSHIP]

    spy = None
    try:
        spy = yahoo.get_history("SPY")["Close"]
    except Exception:
        warnings.append("SPY unavailable: benchmark and drawdown tags skipped.")

    regime_series = None
    if req.regime != "off":
        regime_series = macro.regime_series(spy, fred.get_series("VIXCLS")["value"])

    caps = {t: cap_bucket(t) for t in data} if not req.csv else {}
    spy_dd = (spy / spy.rolling(252, min_periods=1).max() - 1) if spy is not None else None
    tag_ctx = {"cap": lambda tk, t: caps.get(tk, "unknown")}
    if spy_dd is not None:
        tag_ctx["market"] = lambda tk, t: ("after drawdown (SPY >10% off high)" if spy_dd.asof(pd.Timestamp(t.signal_date)) < -0.10 else "calm")
    if regime_series is not None:
        tag_ctx["regime"] = lambda tk, t: str(regime_series.asof(pd.Timestamp(t.signal_date)))
    if len(caps) > 1:
        warnings.append("Market-cap buckets use today's market cap, not the cap at the time of each trade.")

    split = 1 - req.oos_frac
    mode = "on" if req.regime == "on" else "off"
    log_variant(key, {"params": req.params, "exec": asdict(ex), "regime": req.regime})

    is_tr, is_eq = _simulate(key, req.params, ex, data, regime_series, mode, 0, split, tag_ctx)
    oos_tr, oos_eq = _simulate(key, req.params, ex, data, regime_series, mode, split, 1, tag_ctx)
    m_is, m_oos = metrics(is_tr, is_eq), metrics(oos_tr, oos_eq)

    result = {
        "strategy": key, "tickers": list(data), "exec": asdict(ex), "params": req.params,
        "in_sample": m_is, "out_of_sample": m_oos,
        "equity": {"in_sample": _weekly(is_eq), "out_of_sample": _weekly(oos_eq)},
        "trades": [dict(asdict(t), sample="OOS") for t in oos_tr] + [dict(asdict(t), sample="IS") for t in is_tr],
        "breakdowns": {"cap": _breakdown(oos_tr, "cap"), "market": _breakdown(oos_tr, "market")},
    }

    if req.regime == "compare":
        f_tr, f_eq = _simulate(key, req.params, ex, data, regime_series, "on", split, 1, tag_ctx)
        result["regime_compare"] = {"without_filter": m_oos, "with_filter": metrics(f_tr, f_eq)}
        result["breakdowns"]["regime"] = _breakdown(oos_tr, "regime")

    if req.walk_forward and req.grid:
        combos = [dict(zip(req.grid, vals)) for vals in itertools.product(*req.grid.values())]
        if len(combos) > MAX_GRID:
            raise ValueError(f"Grid has {len(combos)} combinations; max is {MAX_GRID}.")
        folds, wf_trades, k = [], [], 4
        edges = [split * j / (k + 1) for j in range(k + 2)]  # walk-forward stays inside the in-sample part
        for j in range(1, k + 1):
            best, best_score = None, None
            for combo in combos:
                p = {**req.params, **combo}
                log_variant(key, {"params": p, "exec": asdict(ex), "regime": req.regime})
                tr, _ = _simulate(key, p, ex, data, regime_series, mode, 0, edges[j], tag_ctx)
                mm = metrics(tr, None)
                score = (mm["trades"] >= 10, mm["expectancy_r"] or -1e9)
                if best_score is None or score > best_score:
                    best, best_score = p, score
            tr, _ = _simulate(key, best, ex, data, regime_series, mode, edges[j], edges[j + 1], tag_ctx)
            wf_trades += tr
            folds.append({"fold": j, "chosen": best, **metrics(tr, None)})
        result["walk_forward"] = {"folds": folds, "combined": metrics(wf_trades, None), "grid_size": len(combos)}

    n_var = variant_count(key)
    result["variants_tried"] = n_var
    # With N independent tries, P(at least one t>2 by luck) ~ 1 - 0.977^N (one-sided 2.3% each).
    result["luck_odds_pct"] = (1 - 0.977 ** n_var) * 100
    result["verdict"] = _verdict(m_oos, n_var)

    bench = {}
    if oos_eq is not None and len(oos_eq):
        start, end = oos_eq.index[0], oos_eq.index[-1]
        for name, s in [*((t, df["Close"]) for t, df in data.items()), *((("SPY", spy),) if spy is not None else ())]:
            w = s[(s.index >= start) & (s.index <= end)]
            if len(w) > 1:
                bench[name] = buy_and_hold(w)
    result["benchmarks"] = bench
    result["warnings"] = warnings
    return result
