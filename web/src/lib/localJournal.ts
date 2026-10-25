// Browser-stored journal used in snapshot mode (no engine). Same shapes and math as engine/app/journal.py.
const KEY = "swingdesk.journal";

type Row = Record<string, unknown> & { id: number; ticker: string; direction: string; entry_date: string; entry: number; stop: number; size: number; exit?: number | null; exit_date?: string | null; followed_plan?: boolean | null; setup: string; emotion: string };

function load(): Row[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function save(rows: Row[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function derive(r: Row) {
  const sign = r.direction === "long" ? 1 : -1;
  const risk = Math.abs(r.entry - r.stop);
  const closed = r.exit != null;
  const days = closed && r.exit_date ? Math.round((Date.parse(r.exit_date) - Date.parse(r.entry_date)) / 864e5) : null;
  return {
    ...r,
    pnl: closed ? sign * (r.exit! - r.entry) * r.size : null,
    r_multiple: closed && risk ? (sign * (r.exit! - r.entry)) / risk : null,
    hold_days: days,
  };
}

function validate(body: Row) {
  if (!/^[A-Za-z0-9.\-^=]{1,12}$/.test(String(body.ticker ?? ""))) throw new Error("Ticker is required");
  if (!(body.entry > 0) || !(body.stop > 0) || !(body.size > 0)) throw new Error("Entry, stop and size must be positive numbers");
  if (!body.entry_date) throw new Error("Entry date is required");
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function group(rows: ReturnType<typeof derive>[], key: (r: ReturnType<typeof derive>) => string) {
  const g = new Map<string, ReturnType<typeof derive>[]>();
  rows.forEach((r) => g.set(key(r), [...(g.get(key(r)) ?? []), r]));
  return [...g.entries()]
    .map(([k, v]) => ({ key: k, n: v.length, win_rate: (v.filter((r) => r.r_multiple! > 0).length / v.length) * 100, avg_r: mean(v.map((r) => r.r_multiple!)) }))
    .sort((a, b) => b.n - a.n);
}

export function list() {
  return load().map(derive).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id);
}

export function create(body: Row) {
  validate(body);
  const rows = load();
  const id = Math.max(0, ...rows.map((r) => r.id)) + 1;
  save([...rows, { ...body, id, ticker: String(body.ticker).toUpperCase() }]);
  return { id };
}

export function update(id: number, body: Row) {
  validate(body);
  const rows = load();
  if (!rows.some((r) => r.id === id)) throw new Error("No such trade");
  save(rows.map((r) => (r.id === id ? { ...body, id, ticker: String(body.ticker).toUpperCase() } : r)));
  return { ok: true };
}

export function remove(id: number) {
  save(load().filter((r) => r.id !== id));
  return { ok: true };
}

export function analytics() {
  const closed = list().filter((r) => r.r_multiple != null);
  if (!closed.length) return { n_closed: 0 };
  const wins = closed.filter((r) => r.r_multiple! > 0);
  const losses = closed.filter((r) => r.r_multiple! <= 0);
  const holds = (xs: typeof closed) => {
    const d = xs.map((r) => r.hold_days).filter((x): x is number => x != null);
    return d.length ? mean(d) : null;
  };
  const hw = holds(wins), hl = holds(losses);
  const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
  return {
    n_closed: closed.length,
    win_rate: (wins.length / closed.length) * 100,
    avg_r: mean(closed.map((r) => r.r_multiple!)),
    total_pnl: closed.reduce((a, r) => a + r.pnl!, 0),
    by_setup: group(closed, (r) => r.setup),
    by_emotion: group(closed, (r) => r.emotion),
    by_weekday: group(closed, (r) => day(r.entry_date)),
    by_plan: group(closed, (r) => (r.followed_plan == null ? "Not recorded" : r.followed_plan ? "Followed plan" : "Broke plan")),
    hold_winners: hw,
    hold_losers: hl,
    disposition_flag: hw != null && hl != null && hl > hw * 1.2,
    r_series: [...closed].sort((a, b) => (a.exit_date ?? a.entry_date).localeCompare(b.exit_date ?? b.entry_date)).map((r) => ({ date: r.exit_date ?? r.entry_date, r: r.r_multiple, ticker: r.ticker })),
  };
}

export function exportJson() {
  return JSON.stringify(load(), null, 2);
}

export function importJson(text: string) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error("Not a journal export");
  save(rows);
}
