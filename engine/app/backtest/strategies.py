"""S1-S3 as pluggable strategies, plus the S4 regime overlay. All signals are causal."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import indicators as ind
from app.backtest.engine import Strategy


class PEAD(Strategy):
    """S1 post-earnings drift. Signal at the close of reaction day 1 when the EPS surprise is
    positive AND day 1 closed up, so the fill is day 2's open. Exits before the next report.

    `events` needs columns reaction_i (bar index of day 1) and surprise_pct. Revenue-surprise
    filtering is not offered: yfinance has no history of revenue estimates.
    """

    name = "S1 PEAD"

    def __init__(self, events: pd.DataFrame, min_surprise: float = 0.0, **p):
        super().__init__(min_surprise=min_surprise, **p)
        self.events = events

    def signals(self, df):
        n = len(df)
        entry, exit_ = np.zeros(n, bool), np.zeros(n, bool)
        c = df["Close"].to_numpy(float)
        for e in self.events.itertuples():
            i = int(e.reaction_i)
            if 1 <= i < n:
                # Leave two bars before each report so we are flat whether it lands pre-market or after the close.
                if i - 2 >= 0:
                    exit_[i - 2] = True
                if pd.notna(e.surprise_pct) and e.surprise_pct > self.params["min_surprise"] and c[i] > c[i - 1]:
                    entry[i] = True
        return pd.DataFrame({"entry": entry, "exit": exit_}, index=df.index)


class Reversal(Strategy):
    """S2 short-term reversal: pullback inside an uptrend (close above the 200-day average)."""

    name = "S2 Reversal"

    def __init__(self, mode: str = "rsi", rsi_threshold: float = 10, down_days: int = 3, **p):
        super().__init__(mode=mode, rsi_threshold=rsi_threshold, down_days=down_days, **p)

    def signals(self, df):
        c = df["Close"]
        trend = c > ind.sma(c, 200)
        if self.params["mode"] == "rsi":
            trigger = ind.rsi(c, 2) < self.params["rsi_threshold"]
        else:
            trigger = ind.streak(c) <= -self.params["down_days"]
        return pd.DataFrame({"entry": (trend & trigger).fillna(False), "exit": (c > ind.sma(c, 5)).fillna(False)}, index=df.index)


class Breakout52(Strategy):
    """S3 52-week-high anchoring breakout.

    Setup: yesterday's close within `near_pct` of the prior 52-week high, and that high within
    `ath_pct` of the all-time high. Entry: close above the prior 52-week high on volume above
    `vol_mult` x the prior 50-day average. Failed breakout: a close back below the breakout
    level within `fail_days` bars of entry.
    """

    name = "S3 52w-high breakout"

    def __init__(self, near_pct: float = 5, ath_pct: float = 10, vol_mult: float = 1.5, fail_days: int = 3, **p):
        super().__init__(near_pct=near_pct, ath_pct=ath_pct, vol_mult=vol_mult, fail_days=fail_days, **p)

    def signals(self, df):
        c, h, v = df["Close"], df["High"], df["Volume"]
        hi52 = h.rolling(252, min_periods=252).max().shift(1)
        ath = h.expanding().max().shift(1)
        vol_avg = v.rolling(50, min_periods=50).mean().shift(1)
        p = self.params
        setup = (c.shift(1) >= hi52 * (1 - p["near_pct"] / 100)) & (hi52 >= ath * (1 - p["ath_pct"] / 100))
        entry = setup & (c > hi52) & (v > p["vol_mult"] * vol_avg)
        return pd.DataFrame({"entry": entry.fillna(False), "exit": False, "ref": hi52, "close": c}, index=df.index)

    def exit_now(self, sig, i, entry_i, ref):
        if i - entry_i < self.params["fail_days"] and sig["close"].iat[i] < ref:
            return "failed_breakout"
        return None


class RegimeFilter(Strategy):
    """S4 overlay: drop a base strategy's entries on days the regime badge reads Risk-Off."""

    def __init__(self, base: Strategy, regime: pd.Series, block: tuple[str, ...] = ("Risk-Off",)):
        super().__init__(**base.params, regime_filter=True)
        self.base, self.regime, self.block = base, regime, block
        self.name = base.name + " + regime filter"

    def signals(self, df):
        s = self.base.signals(df).copy()
        r = self.regime.reindex(df.index, method="ffill")
        s["entry"] = s["entry"] & ~r.isin(self.block).to_numpy()
        return s

    def exit_now(self, sig, i, entry_i, ref):
        return self.base.exit_now(sig, i, entry_i, ref)
