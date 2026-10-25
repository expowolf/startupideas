"""Run one backtest request (JSON in $REQUEST) and publish the result into <out>/backtests.

Run from /engine:  REQUEST='{"strategy":"S2","tickers":["SPY"]}' python -m scripts.run_backtest ../out
The variant counter persists across runs in backtests/variants.json.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DESK_DB", str(Path(tempfile.mkdtemp()) / "desk.db"))

from app.backtest import runner  # noqa: E402
from app.util import clean  # noqa: E402

KEEP_RUNS = 30


def main(out: Path) -> int:
    bt = out / "backtests"
    (bt / "runs").mkdir(parents=True, exist_ok=True)
    vfile = bt / "variants.json"
    rows = json.loads(vfile.read_text()) if vfile.exists() else []
    with runner._variants_conn() as conn:
        conn.executemany("INSERT OR IGNORE INTO variants (strategy, hash, params, created_at) VALUES (?, ?, ?, ?)",
                         [(r["strategy"], r["hash"], r["params"], r["created_at"]) for r in rows])

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    raw = os.environ.get("REQUEST", "")
    try:
        req = runner.BacktestRequest(**json.loads(raw))
        result = {"ok": True, "request": json.loads(raw), "result": clean(runner.run_request(req))}
    except Exception as e:
        result = {"ok": False, "request": raw, "error": f"{type(e).__name__}: {e}"}
    result["run_at"] = stamp

    with runner._variants_conn() as conn:
        cur = conn.execute("SELECT strategy, hash, params, created_at FROM variants")
        rows = [dict(zip(["strategy", "hash", "params", "created_at"], r)) for r in cur.fetchall()]
    vfile.write_text(json.dumps(rows))
    (bt / "variant_counts.json").write_text(json.dumps(runner.variant_counts()))
    (bt / "latest.json").write_text(json.dumps(result, separators=(",", ":")))
    (bt / "runs" / f"{stamp}.json").write_text(json.dumps(result, separators=(",", ":")))

    runs = sorted((bt / "runs").glob("*.json"))
    for old in runs[:-KEEP_RUNS]:
        old.unlink()
    print("ok" if result["ok"] else f"error: {result['error']}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
