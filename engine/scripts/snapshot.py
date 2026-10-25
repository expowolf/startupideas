"""Nightly snapshot: run every analysis for the watchlist and write static JSON for the web app.

Run from /engine:  python -m scripts.snapshot ../watchlist.txt ../out
Writes <out>/<TICKER>/<name>.json, <out>/macro.json, <out>/regime.json and <out>/index.json.
Anything under <out>/backtests is left untouched. A failed endpoint is written as {"_error": "..."}.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from app.analysis import earnings, fundamentals, macro, options, sentiment, technicals, traps, valuation, verdict  # noqa: E402
from app.clients import yahoo  # noqa: E402
from app.util import clean  # noqa: E402

MAX_TICKERS = 60
KEEP_BARS = 2520  # ~10 years of daily data keeps each ticker around 1 MB
TICKER_RE = re.compile(r"^[A-Z0-9.\-^=]{1,12}$")


def read_watchlist(path: Path) -> list[str]:
    out = []
    for line in path.read_text().splitlines():
        t = line.split("#")[0].strip().upper()
        if t and TICKER_RE.match(t) and t not in out:
            out.append(t)
    return out[:MAX_TICKERS]


def prices(t: str) -> dict:
    df = yahoo.get_history(t).iloc[-KEEP_BARS:].reset_index()
    df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
    return {"ticker": t, "bars": df.round(4).to_dict(orient="records")}


def tech(t: str) -> dict:
    d = technicals.analyze(t)
    for k in ("rsi14", "rsi2", "macd", "macd_signal", "macd_hist"):
        d[k] = d[k][-KEEP_BARS:]
    return d


ENDPOINTS = {
    "prices": prices,
    "technicals": tech,
    "earnings": earnings.analyze,
    "fundamentals_quarterly": lambda t: fundamentals.analyze(t, "quarterly"),
    "fundamentals_annual": lambda t: fundamentals.analyze(t, "annual"),
    "valuation": valuation.analyze,
    "options": options.analyze,
    "sentiment": sentiment.analyze,
    "traps": traps.analyze,
    "verdict": verdict.analyze,
}


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(data), separators=(",", ":")))


def attempt(fn, *args):
    try:
        return fn(*args), None
    except Exception as e:
        traceback.print_exc()
        return {"_error": f"{type(e).__name__}: {e}"}, f"{type(e).__name__}: {e}"


def main(watchlist: Path, out: Path) -> int:
    out.mkdir(parents=True, exist_ok=True)
    for child in out.iterdir():  # replace yesterday's data, keep backtest results
        if child.name not in (".git", "backtests"):
            shutil.rmtree(child) if child.is_dir() else child.unlink()

    tickers = read_watchlist(watchlist)
    errors: dict[str, dict[str, str]] = {}
    ok = []
    for t in tickers:
        print(f"== {t}", flush=True)
        for name, fn in ENDPOINTS.items():
            data, err = attempt(fn, t)
            write(out / t / f"{name}.json", data)
            if err:
                errors.setdefault(t, {})[name] = err
        if "prices" not in errors.get(t, {}):
            ok.append(t)

    for name, fn in (("macro", macro.analyze), ("regime", macro.regime)):
        data, err = attempt(fn)
        write(out / f"{name}.json", data)
        if err:
            errors.setdefault("_market", {})[name] = err

    write(out / "index.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "tickers": ok,
        "requested": tickers,
        "errors": errors,
    })
    print(f"done: {len(ok)}/{len(tickers)} tickers with prices; {sum(len(v) for v in errors.values())} endpoint errors")
    return 0 if ok else 1  # fail the workflow if Yahoo returned nothing at all


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2])))
