"""Event-driven daily backtester.

Rules (non-negotiable, enforced by tests):
  * Signals are computed on bar t's close using only data <= t.
  * Orders fill at bar t+1's open, with slippage (default 5 bps per side) and commission.
  * Stops and targets are ATR multiples, fixed from the ATR on the signal bar.
    A stop hit intrabar fills at the stop, or at the open if price gapped through it.
    If stop and target are both touched in one bar, the stop is assumed (conservative).
  * One position at a time per ticker, fully invested while in a trade.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from app import indicators as ind


@dataclass
class ExecParams:
    stop_atr: float = 2.0
    target_atr: float | None = None
    trail_atr: float | None = None
    max_hold: int = 10
    slippage_bps: float = 5.0
    commission_bps: float = 0.0
    atr_period: int = 14


@dataclass
class Trade:
    ticker: str
    signal_date: str
    entry_date: str
    entry: float
    stop: float
    exit_date: str = ""
    exit: float = 0.0
    reason: str = ""
    bars: int = 0
    ret_pct: float = 0.0
    r: float = 0.0
    tags: dict = field(default_factory=dict)


class Strategy:
    """Subclasses fill `signals(df)` -> DataFrame[entry: bool, exit: bool, ref: float]. Must be causal."""

    name = "base"

    def __init__(self, **params):
        self.params = params

    def signals(self, df: pd.DataFrame) -> pd.DataFrame:
        raise NotImplementedError

    def exit_now(self, sig: pd.DataFrame, i: int, entry_i: int, ref: float) -> str | None:
        """Extra exit check at bar i's close while in a trade. Return a reason or None."""
        return None


def run(df: pd.DataFrame, strat: Strategy, ex: ExecParams, start: int = 0, end: int | None = None,
        ticker: str = "", sig: pd.DataFrame | None = None) -> tuple[list[Trade], pd.Series]:
    """Backtest bars [start, end). Returns trades and the daily equity curve (starts at 1.0)."""
    end = len(df) if end is None else end
    sig = strat.signals(df) if sig is None else sig
    o, h, l, c = (df[k].to_numpy(float) for k in ("Open", "High", "Low", "Close"))
    atr = ind.atr(df, ex.atr_period).to_numpy(float)
    entry_sig, exit_sig = sig["entry"].to_numpy(bool), sig["exit"].to_numpy(bool)
    ref = sig["ref"].to_numpy(float) if "ref" in sig else np.full(len(df), np.nan)
    dates = df.index
    slip, comm = ex.slippage_bps / 1e4, ex.commission_bps / 1e4

    trades: list[Trade] = []
    equity = np.ones(end - start)
    cash, pos, pending = 1.0, None, None  # pending = ("entry", signal_i) or ("exit", reason)

    def close_trade(i: int, px: float, reason: str):
        nonlocal cash, pos
        t: Trade = pos["trade"]
        gross = px / t.entry
        ret = gross * (1 - comm) / (1 + comm) - 1
        t.exit_date, t.exit, t.reason = dates[i].strftime("%Y-%m-%d"), px, reason
        t.bars = i - pos["entry_i"] + 1
        t.ret_pct = ret * 100
        t.r = ret * t.entry / pos["risk"] if pos["risk"] > 0 else 0.0
        cash *= 1 + ret
        trades.append(t)
        pos = None

    for i in range(start, end):
        # 1) Fill orders decided at the previous close, at this bar's open.
        if pending and pending[0] == "exit" and pos:
            close_trade(i, o[i] * (1 - slip), pending[1])
        elif pending and pending[0] == "entry" and pos is None:
            s = pending[1]
            a = atr[s]
            if not math.isnan(a) and a > 0:
                px = o[i] * (1 + slip)
                stop = px - ex.stop_atr * a
                pos = {
                    "entry_i": i, "risk": px - stop, "stop": stop, "ref": ref[s],
                    "target": px + ex.target_atr * a if ex.target_atr else None,
                    "trade": Trade(ticker, dates[s].strftime("%Y-%m-%d"), dates[i].strftime("%Y-%m-%d"), px, stop),
                }
        pending = None

        # 2) Intrabar stop / target.
        if pos:
            first = i == pos["entry_i"]
            if l[i] <= pos["stop"]:
                fill = pos["stop"] if first else min(o[i], pos["stop"])
                close_trade(i, fill * (1 - slip), "stop")
            elif pos["target"] is not None and h[i] >= pos["target"]:
                fill = pos["target"] if first else max(o[i], pos["target"])
                close_trade(i, fill * (1 - slip), "target")

        # 3) Decisions at this bar's close (executed next bar).
        if pos:
            if ex.trail_atr and not math.isnan(atr[i]):
                pos["stop"] = max(pos["stop"], c[i] - ex.trail_atr * atr[i])
            held = i - pos["entry_i"] + 1
            reason = ("signal" if exit_sig[i] else None) or strat.exit_now(sig, i, pos["entry_i"], pos["ref"]) \
                or ("max_hold" if held >= ex.max_hold else None)
            if reason and i + 1 < end:
                pending = ("exit", reason)
        elif entry_sig[i] and i + 1 < end:
            pending = ("entry", i)

        equity[i - start] = cash * (c[i] / pos["trade"].entry if pos else 1.0)

    if pos:  # window over: mark out at the last close
        close_trade(end - 1, c[end - 1] * (1 - slip), "end_of_window")
        equity[-1] = cash
    return trades, pd.Series(equity, index=dates[start:end])


def metrics(trades: list[Trade], equity: pd.Series | None) -> dict:
    n = len(trades)
    rets = np.array([t.ret_pct for t in trades]) / 100
    rs = np.array([t.r for t in trades])
    wins, losses = rets[rets > 0], rets[rets <= 0]
    out = {
        "trades": n,
        "win_rate": float(len(wins) / n * 100) if n else None,
        "avg_win_pct": float(wins.mean() * 100) if len(wins) else None,
        "avg_loss_pct": float(losses.mean() * 100) if len(losses) else None,
        "expectancy_r": float(rs.mean()) if n else None,
        "profit_factor": float(wins.sum() / -losses.sum()) if len(losses) and losses.sum() < 0 else None,
        # t-stat of mean trade return: mean / (sd / sqrt(n)).
        "t_stat": float(rets.mean() / (rets.std(ddof=1) / math.sqrt(n))) if n > 1 and rets.std(ddof=1) > 0 else None,
    }
    if equity is not None and len(equity) > 1:
        dd = equity / equity.cummax() - 1
        years = (equity.index[-1] - equity.index[0]).days / 365.25
        daily = equity.pct_change().dropna()
        out.update({
            "max_drawdown_pct": float(dd.min() * 100),
            "cagr_pct": float((equity.iloc[-1] ** (1 / years) - 1) * 100) if years > 0 and equity.iloc[-1] > 0 else None,
            "sharpe": float(daily.mean() / daily.std() * math.sqrt(252)) if daily.std() > 0 else None,
            "exposure_pct": float(sum(t.bars for t in trades) / len(equity) * 100),
            "total_return_pct": float((equity.iloc[-1] - 1) * 100),
        })
    return out


def buy_and_hold(close: pd.Series) -> dict:
    eq = close / close.iloc[0]
    m = metrics([], eq)
    return {k: m.get(k) for k in ("total_return_pct", "cagr_pct", "max_drawdown_pct", "sharpe")}
