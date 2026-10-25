"""Trade journal (SQLite) and the behavioral analytics built on it."""
from __future__ import annotations

from datetime import date

import pandas as pd
from pydantic import BaseModel, Field

from app.db import connect

EMOTIONS = ["calm", "FOMO", "revenge", "bored", "confident", "anxious"]
FIELDS = ["ticker", "direction", "entry_date", "entry", "stop", "target", "size", "thesis", "wrong_if",
          "planned_exit_date", "setup", "emotion", "followed_plan", "exit_date", "exit", "note"]


class Trade(BaseModel):
    ticker: str = Field(pattern=r"^[A-Za-z0-9.\-^=]{1,12}$")
    direction: str = Field("long", pattern="^(long|short)$")
    entry_date: date
    entry: float = Field(gt=0)
    stop: float = Field(gt=0)
    target: float | None = None
    size: float = Field(gt=0, description="Shares")
    thesis: str = ""
    wrong_if: str = ""
    planned_exit_date: date | None = None
    setup: str = "other"
    emotion: str = Field("calm", pattern="^(" + "|".join(EMOTIONS) + ")$")
    followed_plan: bool | None = None
    exit_date: date | None = None
    exit: float | None = None
    note: str = ""


def _conn():
    conn = connect()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS journal (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, "
        + ", ".join(f"{f} TEXT" for f in FIELDS) + ")"
    )
    return conn


def _derive(r: dict) -> dict:
    """P&L, R-multiple and holding days. R = profit per share / initial risk per share."""
    sign = 1 if r["direction"] == "long" else -1
    entry, stop, ex = float(r["entry"]), float(r["stop"]), r.get("exit")
    risk = abs(entry - stop)
    r["pnl"] = r["r_multiple"] = r["hold_days"] = None
    if ex not in (None, ""):
        ex = float(ex)
        r["pnl"] = sign * (ex - entry) * float(r["size"])
        r["r_multiple"] = sign * (ex - entry) / risk if risk else None
        if r.get("exit_date"):
            r["hold_days"] = (date.fromisoformat(r["exit_date"]) - date.fromisoformat(r["entry_date"])).days
    return r


def _row(cur, row) -> dict:
    d = dict(zip([c[0] for c in cur.description], row))
    for k in ("entry", "stop", "target", "size", "exit"):
        d[k] = float(d[k]) if d[k] not in (None, "", "None") else None
    d["followed_plan"] = None if d["followed_plan"] in (None, "None", "") else d["followed_plan"] == "True"
    for k in ("planned_exit_date", "exit_date"):
        d[k] = None if d[k] in ("None", "") else d[k]
    return _derive(d)


def list_trades() -> list[dict]:
    with _conn() as conn:
        cur = conn.execute("SELECT * FROM journal ORDER BY entry_date DESC, id DESC")
        return [_row(cur, r) for r in cur.fetchall()]


def create(t: Trade) -> int:
    vals = [str(getattr(t, f)) if getattr(t, f) is not None else None for f in FIELDS]
    with _conn() as conn:
        cur = conn.execute(f"INSERT INTO journal ({', '.join(FIELDS)}) VALUES ({', '.join('?' * len(FIELDS))})", vals)
        return cur.lastrowid


def update(trade_id: int, t: Trade) -> bool:
    vals = [str(getattr(t, f)) if getattr(t, f) is not None else None for f in FIELDS]
    with _conn() as conn:
        cur = conn.execute(f"UPDATE journal SET {', '.join(f + ' = ?' for f in FIELDS)} WHERE id = ?", [*vals, trade_id])
        return cur.rowcount > 0


def delete(trade_id: int) -> bool:
    with _conn() as conn:
        return conn.execute("DELETE FROM journal WHERE id = ?", (trade_id,)).rowcount > 0


def _group(df: pd.DataFrame, col: str) -> list[dict]:
    out = []
    for key, g in df.groupby(col, dropna=False):
        out.append({"key": str(key), "n": len(g), "win_rate": float((g["r_multiple"] > 0).mean() * 100), "avg_r": float(g["r_multiple"].mean())})
    return sorted(out, key=lambda x: -x["n"])


def analytics() -> dict:
    closed = [t for t in list_trades() if t["r_multiple"] is not None]
    if not closed:
        return {"n_closed": 0}
    df = pd.DataFrame(closed)
    df["weekday"] = pd.to_datetime(df["entry_date"]).dt.day_name()
    df["followed"] = df["followed_plan"].map({True: "Followed plan", False: "Broke plan"}).fillna("Not recorded")
    win, loss = df[df["r_multiple"] > 0], df[df["r_multiple"] <= 0]
    hw = float(win["hold_days"].mean()) if win["hold_days"].notna().any() else None
    hl = float(loss["hold_days"].mean()) if loss["hold_days"].notna().any() else None
    return {
        "n_closed": len(df),
        "win_rate": float((df["r_multiple"] > 0).mean() * 100),
        "avg_r": float(df["r_multiple"].mean()),
        "total_pnl": float(df["pnl"].sum()),
        "by_setup": _group(df, "setup"),
        "by_emotion": _group(df, "emotion"),
        "by_weekday": _group(df, "weekday"),
        "by_plan": _group(df, "followed"),
        "hold_winners": hw,
        "hold_losers": hl,
        # Disposition effect (Odean 1998): holding losers noticeably longer than winners.
        "disposition_flag": hw is not None and hl is not None and hl > hw * 1.2,
        "r_series": [{"date": r["exit_date"] or r["entry_date"], "r": r["r_multiple"], "ticker": r["ticker"]} for r in sorted(closed, key=lambda r: r["exit_date"] or r["entry_date"])],
    }
