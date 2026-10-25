"""Nightly snapshot and Action backtest scripts, against the fake data fixture."""
import json

from scripts import run_backtest, snapshot
from tests.test_analysis import fake  # noqa: F401  (fixture)


def test_snapshot_writes_every_endpoint(fake, tmp_path):  # noqa: F811
    wl = tmp_path / "watchlist.txt"
    wl.write_text("# comment\naaa\nNOPE!\nAAA\n")
    out = tmp_path / "out"
    (out / "backtests").mkdir(parents=True)
    (out / "backtests" / "keep.json").write_text("{}")
    (out / "stale.json").write_text("{}")
    assert snapshot.main(wl, out) == 0
    idx = json.loads((out / "index.json").read_text())
    assert idx["tickers"] == ["AAA"] and idx["errors"] == {}
    for name in snapshot.ENDPOINTS:
        assert "_error" not in json.loads((out / "AAA" / f"{name}.json").read_text()), name
    assert (out / "macro.json").exists() and (out / "regime.json").exists()
    assert (out / "backtests" / "keep.json").exists() and not (out / "stale.json").exists()


def test_snapshot_records_failures(fake, tmp_path, monkeypatch):  # noqa: F811
    wl = tmp_path / "w.txt"
    wl.write_text("ZZZ\n")
    assert snapshot.main(wl, tmp_path / "out") == 1  # no ticker had prices
    assert "_error" in json.loads((tmp_path / "out" / "ZZZ" / "prices.json").read_text())


def test_action_backtest_persists_variants(fake, tmp_path, monkeypatch):  # noqa: F811
    out = tmp_path / "out"
    for t in (5, 10, 10):
        monkeypatch.setenv("REQUEST", json.dumps({"strategy": "S2", "tickers": ["AAA"], "params": {"rsi_threshold": t}}))
        assert run_backtest.main(out) == 0
    assert json.loads((out / "backtests" / "variant_counts.json").read_text())["S2"] == 2
    latest = json.loads((out / "backtests" / "latest.json").read_text())
    assert latest["ok"] and latest["result"]["strategy"] == "S2"
    monkeypatch.setenv("REQUEST", "not json")
    assert run_backtest.main(out) == 1
    assert json.loads((out / "backtests" / "latest.json").read_text())["ok"] is False
