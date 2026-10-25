"""Offline tests: cache, backoff, client caching, API. No network needed."""
from datetime import datetime

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import db
from app.backoff import with_backoff
from app.clients import fred, yahoo


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DESK_DB", str(tmp_path / "test.db"))


def _bars():
    idx = pd.date_range("2024-01-01", periods=3, freq="D", name="Date")
    return pd.DataFrame(
        {"Open": [1.0, 2, 3], "High": [1.5, 2.5, 3.5], "Low": [0.5, 1.5, 2.5],
         "Close": [1.2, 2.2, 3.2], "Volume": [100, 200, 300]},
        index=idx,
    )


def test_dataframe_roundtrip_keeps_dates():
    db.put_cached("k", _bars())
    out = db.get_cached("k", ttl_seconds=60)
    pd.testing.assert_frame_equal(out, _bars(), check_freq=False, check_names=False)


def test_ttl_expiry(monkeypatch):
    db.put_cached("k", {"a": 1})
    assert db.get_cached("k", 60) == {"a": 1}
    real = db.time.time
    monkeypatch.setattr(db.time, "time", lambda: real() + 61)
    assert db.get_cached("k", 60) is None


def test_backoff_retries_then_succeeds():
    calls, sleeps = [], []

    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise ConnectionError("rate limited")
        return "ok"

    assert with_backoff(flaky, sleep=sleeps.append) == "ok"
    assert len(calls) == 3
    assert 2 <= sleeps[0] < 2.5 and 4 <= sleeps[1] < 4.5


def test_backoff_gives_up():
    with pytest.raises(ConnectionError):
        with_backoff(lambda: (_ for _ in ()).throw(ConnectionError()), retries=2, sleep=lambda s: None)


def test_history_hits_network_once(monkeypatch):
    calls = []

    class FakeTicker:
        def __init__(self, t):
            pass

        def history(self, **kw):
            calls.append(kw)
            return _bars().assign(Dividends=0.0)

    monkeypatch.setattr(yahoo.yf, "Ticker", FakeTicker)
    a = yahoo.get_history("AAPL")
    b = yahoo.get_history("AAPL")
    assert len(calls) == 1
    assert list(a.columns) == yahoo.OHLCV
    assert len(b) == 3


def test_fred_staleness():
    info = {"frequency": "M", "last_observation": "2026-01-01"}
    assert fred.is_stale(info, today=datetime(2026, 6, 1))
    assert not fred.is_stale(info, today=datetime(2026, 2, 1))


def test_api(monkeypatch):
    from app.main import app

    monkeypatch.setattr(yahoo, "get_history", lambda t: _bars())
    c = TestClient(app)
    assert c.get("/health").json() == {"ok": True}
    r = c.get("/api/prices/aapl").json()
    assert r["ticker"] == "AAPL" and r["bars"][0]["Date"] == "2024-01-01"
    assert c.get("/api/prices/bad;ticker").status_code == 400
    assert c.get("/api/macro/NOTREAL").status_code == 404


def test_backoff_does_not_retry_permanent_errors():
    from app.backoff import PermanentError
    calls = []

    def missing_key():
        calls.append(1)
        raise PermanentError("no key")

    with pytest.raises(PermanentError):
        with_backoff(missing_key, sleep=lambda s: pytest.fail("should not sleep"))
    assert len(calls) == 1
