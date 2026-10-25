import numpy as np
import pandas as pd
import pytest


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DESK_DB", str(tmp_path / "test.db"))


def make_bars(n=1200, seed=1, drift=0.0005, vol=0.018, start="2018-01-02"):
    rng = np.random.default_rng(seed)
    c = 50 * np.exp(np.cumsum(rng.normal(drift, vol, n)))
    o = c * np.exp(rng.normal(0, vol / 3, n))
    hi = np.maximum(o, c) * (1 + np.abs(rng.normal(0, vol / 2, n)))
    lo = np.minimum(o, c) * (1 - np.abs(rng.normal(0, vol / 2, n)))
    idx = pd.bdate_range(start, periods=n, name="Date")
    return pd.DataFrame({"Open": o, "High": hi, "Low": lo, "Close": c, "Volume": rng.integers(1e6, 5e6, n).astype(float)}, index=idx)


@pytest.fixture
def bars():
    return make_bars()
