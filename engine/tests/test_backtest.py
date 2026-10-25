"""Backtest correctness. The look-ahead tests are the point: changing the future must not change the past."""
import numpy as np
import pandas as pd
import pytest

from app import indicators as ind
from app.backtest.engine import ExecParams, Strategy, Trade, metrics, run
from app.backtest.strategies import PEAD, Breakout52, RegimeFilter, Reversal
from tests.conftest import make_bars


def scramble_future(df, k, seed=99):
    """Replace every bar from k on with unrelated random data."""
    other = make_bars(len(df), seed=seed)
    out = df.copy()
    out.iloc[k:] = other.iloc[k:].to_numpy()
    return out


STRATS = [
    lambda: Reversal(mode="rsi", rsi_threshold=10),
    lambda: Reversal(mode="streak", down_days=3),
    lambda: Breakout52(near_pct=5, ath_pct=10),
]


@pytest.mark.parametrize("make", STRATS)
def test_signals_do_not_change_when_future_changes(make, bars):
    k = 800
    a = make().signals(bars)
    b = make().signals(scramble_future(bars, k))
    pd.testing.assert_frame_equal(a.iloc[:k][["entry", "exit"]], b.iloc[:k][["entry", "exit"]])


@pytest.mark.parametrize("make", STRATS)
def test_signals_equal_on_truncated_data(make, bars):
    k = 700
    full = make().signals(bars).iloc[:k]
    cut = make().signals(bars.iloc[:k])
    pd.testing.assert_frame_equal(full[["entry", "exit"]], cut[["entry", "exit"]])


@pytest.mark.parametrize("fn", [lambda s: ind.rsi(s, 2), lambda s: ind.sma(s, 50), lambda s: ind.macd(s)["hist"], lambda s: ind.streak(s)])
def test_indicators_are_causal(fn, bars):
    k = 600
    a = fn(bars["Close"]).iloc[:k]
    b = fn(scramble_future(bars, k)["Close"]).iloc[:k]
    pd.testing.assert_series_equal(a, b)


@pytest.mark.parametrize("make", STRATS)
def test_closed_trades_unchanged_by_future(make, bars):
    k = 900
    ex = ExecParams(stop_atr=2, max_hold=10)
    t1, _ = run(bars, make(), ex)
    t2, _ = run(scramble_future(bars, k), make(), ex)
    cutoff = bars.index[k - 1].strftime("%Y-%m-%d")
    done1 = [t for t in t1 if t.exit_date < cutoff]
    done2 = [t for t in t2 if t.exit_date < cutoff]
    assert done1 and [(t.entry_date, t.exit_date, round(t.entry, 8), round(t.exit, 8)) for t in done1] == \
        [(t.entry_date, t.exit_date, round(t.entry, 8), round(t.exit, 8)) for t in done2]


class OneShot(Strategy):
    """Signal on a single bar; no exit signal."""

    def __init__(self, at):
        super().__init__(at=at)

    def signals(self, df):
        e = np.zeros(len(df), bool)
        e[self.params["at"]] = True
        return pd.DataFrame({"entry": e, "exit": False}, index=df.index)


def test_entry_fills_next_open_with_slippage(bars):
    ex = ExecParams(stop_atr=50, max_hold=3, slippage_bps=5)
    trades, _ = run(bars, OneShot(100), ex)
    t = trades[0]
    assert t.signal_date == bars.index[100].strftime("%Y-%m-%d")
    assert t.entry_date == bars.index[101].strftime("%Y-%m-%d")
    assert t.entry == pytest.approx(bars["Open"].iloc[101] * 1.0005)
    # max_hold=3: held bars 101,102,103, exit decided at 103's close, filled at 104's open.
    assert t.exit_date == bars.index[104].strftime("%Y-%m-%d")
    assert t.exit == pytest.approx(bars["Open"].iloc[104] * 0.9995)
    assert t.reason == "max_hold"


def test_stop_gap_fills_at_open():
    df = make_bars(300)
    i = 150
    df.iloc[i + 1, df.columns.get_loc("Open")] = df["Close"].iloc[i]
    # Next bar gaps far below any stop.
    gap = df["Close"].iloc[i] * 0.5
    df.iloc[i + 2, [0, 1, 2, 3]] = [gap, gap * 1.01, gap * 0.99, gap]
    trades, _ = run(df, OneShot(i), ExecParams(stop_atr=2, max_hold=50, slippage_bps=0))
    t = trades[0]
    assert t.reason == "stop" and t.exit == pytest.approx(gap)
    assert t.r < -1  # gapping through a stop loses more than 1R


def test_signal_on_last_bar_is_not_traded(bars):
    trades, _ = run(bars, OneShot(len(bars) - 1), ExecParams())
    assert trades == []


def test_window_respected(bars):
    trades, eq = run(bars, Reversal(), ExecParams(), 500, 800)
    assert len(eq) == 300
    assert all(bars.index[500].strftime("%Y-%m-%d") <= t.entry_date and t.exit_date <= bars.index[799].strftime("%Y-%m-%d") for t in trades)


def test_breakout_failed_exit(bars):
    s = Breakout52(near_pct=5, ath_pct=50, vol_mult=0.0)
    trades, _ = run(bars, s, ExecParams(stop_atr=10, trail_atr=None, max_hold=30))
    assert trades, "expected some breakouts on a drifting series"
    assert all(t.reason in {"failed_breakout", "stop", "max_hold", "end_of_window"} for t in trades)


def test_pead_enters_day_two(bars):
    c = bars["Close"]
    i = next(k for k in range(300, 600) if c.iloc[k] > c.iloc[k - 1])
    events = pd.DataFrame({"reaction_i": [i], "surprise_pct": [5.0]})
    trades, _ = run(bars, PEAD(events), ExecParams(stop_atr=50, max_hold=5))
    assert trades[0].entry_date == bars.index[i + 1].strftime("%Y-%m-%d")


def test_pead_skips_negative_reaction(bars):
    c = bars["Close"]
    i = next(k for k in range(300, 600) if c.iloc[k] < c.iloc[k - 1])
    events = pd.DataFrame({"reaction_i": [i], "surprise_pct": [5.0]})
    assert run(bars, PEAD(events), ExecParams())[0] == []


def test_regime_filter_blocks_risk_off(bars):
    base = Reversal(rsi_threshold=30)
    regime = pd.Series("Risk-Off", index=bars.index)
    assert not RegimeFilter(base, regime).signals(bars)["entry"].any()
    assert base.signals(bars)["entry"].any()


def test_metrics_known_values():
    def tr(ret):
        return Trade("X", "", "", 100, 90, ret_pct=ret, r=ret / 10)
    m = metrics([tr(10), tr(-5), tr(20), tr(-5)], None)
    assert m["trades"] == 4 and m["win_rate"] == 50
    assert m["profit_factor"] == pytest.approx(3.0)
    rets = np.array([0.10, -0.05, 0.20, -0.05])
    assert m["t_stat"] == pytest.approx(rets.mean() / (rets.std(ddof=1) / 2))
