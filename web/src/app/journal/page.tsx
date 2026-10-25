"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/engine";
import { EMOTIONS, SETUPS } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/Panel";
import { SignedBars } from "@/components/charts";
import { Async, fmt, Note, Stat } from "@/components/ui";

type Trade = {
  id: number; ticker: string; direction: string; entry_date: string; entry: number; stop: number; target: number | null; size: number;
  thesis: string; wrong_if: string; planned_exit_date: string | null; setup: string; emotion: string; followed_plan: boolean | null;
  exit_date: string | null; exit: number | null; note: string; pnl: number | null; r_multiple: number | null; hold_days: number | null;
};
type Group = { key: string; n: number; win_rate: number; avg_r: number };
type Analytics = {
  n_closed: number; win_rate?: number; avg_r?: number; total_pnl?: number; hold_winners?: number | null; hold_losers?: number | null; disposition_flag?: boolean;
  by_setup?: Group[]; by_emotion?: Group[]; by_weekday?: Group[]; by_plan?: Group[]; r_series?: { date: string; r: number; ticker: string }[];
};

const input = "w-full rounded border border-line bg-panel-2 px-2 py-1 text-sm outline-none focus:border-accent";
const blank = { ticker: "", direction: "long", entry_date: new Date().toISOString().slice(0, 10), entry: "", stop: "", target: "", size: "", thesis: "", wrong_if: "", planned_exit_date: "", setup: "pullback", emotion: "calm", followed_plan: "", exit_date: "", exit: "", note: "" };

function toBody(f: Record<string, string>) {
  const num = (s: string) => (s === "" ? null : Number(s));
  return { ...f, ticker: f.ticker.toUpperCase(), entry: num(f.entry), stop: num(f.stop), target: num(f.target), size: num(f.size), exit: num(f.exit),
    exit_date: f.exit_date || null, planned_exit_date: f.planned_exit_date || null, followed_plan: f.followed_plan === "" ? null : f.followed_plan === "yes" };
}

function GroupTable({ title, rows }: { title: string; rows?: Group[] }) {
  if (!rows?.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs text-muted">{title}</h3>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="font-normal">Group</th><th className="text-right font-normal">Trades</th><th className="text-right font-normal">Win %</th><th className="text-right font-normal">Avg R</th></tr></thead>
        <tbody className="num">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="py-1 font-sans">{r.key}</td><td className="text-right">{r.n}</td><td className="text-right">{r.win_rate.toFixed(0)}</td>
              <td className={cn("text-right", r.avg_r >= 0 ? "text-up" : "text-down")}>{r.avg_r >= 0 ? "+" : ""}{r.avg_r.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function JournalPage() {
  const trades = useApi<Trade[]>("/api/journal");
  const stats = useApi<Analytics>("/api/journal/analytics");
  const [f, setF] = useState<Record<string, string>>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const refresh = () => { trades.reload(); stats.reload(); };

  async function save() {
    try {
      await api(editing ? `/api/journal/${editing}` : "/api/journal", { method: editing ? "PUT" : "POST", body: JSON.stringify(toBody(f)) });
      setF(blank); setEditing(null); setMsg(null); refresh();
    } catch (e) { setMsg((e as Error).message); }
  }
  function edit(t: Trade) {
    setEditing(t.id);
    setF(Object.fromEntries(Object.keys(blank).map((k) => {
      const v = t[k as keyof Trade];
      if (k === "followed_plan") return [k, v == null ? "" : v ? "yes" : "no"];
      return [k, v == null ? "" : String(v)];
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remove(id: number) {
    if (!confirm("Delete this trade?")) return;
    await api(`/api/journal/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Trade journal</h1>
      <Panel title={editing ? `Edit trade #${editing}` : "New trade"} caption="Log the plan at entry; come back to fill in the exit, whether you followed the plan, and what you learned." info="R-multiple = profit per share ÷ initial risk per share (entry − stop). +2R means you made twice what you risked. Followed plan? is the most important column: it separates bad luck from bad discipline.">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {[["ticker", "Ticker"], ["entry_date", "Entry date", "date"], ["entry", "Entry"], ["stop", "Stop"], ["target", "Target"], ["size", "Size (shares)"], ["exit_date", "Exit date", "date"], ["exit", "Exit price"]].map(([k, label, type]) => (
            <label key={k} className="text-xs text-muted">{label}<input type={type ?? "text"} className={cn(input, "num")} value={f[k]} onChange={set(k)} /></label>
          ))}
          <label className="text-xs text-muted">Direction<select className={input} value={f.direction} onChange={set("direction")}><option>long</option><option>short</option></select></label>
          <label className="text-xs text-muted">Setup<select className={input} value={f.setup} onChange={set("setup")}>{SETUPS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs text-muted">Emotion at entry<select className={input} value={f.emotion} onChange={set("emotion")}>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs text-muted">Followed plan?<select className={input} value={f.followed_plan} onChange={set("followed_plan")}><option value="">—</option><option value="yes">Y</option><option value="no">N</option></select></label>
          <label className="text-xs text-muted">Planned exit<input type="date" className={input} value={f.planned_exit_date} onChange={set("planned_exit_date")} /></label>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className="text-xs text-muted">Thesis<textarea rows={2} className={input} value={f.thesis} onChange={set("thesis")} /></label>
          <label className="text-xs text-muted">What proves me wrong<textarea rows={2} className={input} value={f.wrong_if} onChange={set("wrong_if")} /></label>
          <label className="text-xs text-muted">Post-trade note<textarea rows={2} className={input} value={f.note} onChange={set("note")} /></label>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button onClick={save} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg">{editing ? "Save changes" : "Add trade"}</button>
          {editing && <button onClick={() => { setEditing(null); setF(blank); }} className="text-sm text-muted">Cancel</button>}
          {msg && <span className="text-xs text-down">{msg}</span>}
        </div>
      </Panel>

      <Panel title="Your behavior" caption="Where do your results actually come from: the setup, your mood, the day, or whether you stuck to the plan?" info="Win rate and average R per group. The disposition effect (Odean 1998) is the habit of cutting winners early and holding losers too long; it shows up as losers held noticeably longer than winners. Small groups (under ~20 trades) are mostly noise.">
        <Async q={stats} h={200}>
          {(a) => a.n_closed === 0 ? <p className="text-sm text-muted">Close some trades (add an exit price) to see analytics.</p> : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stat label="Closed trades" value={a.n_closed} />
                <Stat label="Win rate" value={`${a.win_rate!.toFixed(0)}%`} />
                <Stat label="Avg R" value={fmt.num(a.avg_r, 2)} tone={a.avg_r! >= 0 ? "up" : "down"} />
                <Stat label="Total P&L" value={fmt.big(a.total_pnl)} tone={a.total_pnl! >= 0 ? "up" : "down"} />
                <Stat label="Hold: winners / losers" value={`${fmt.num(a.hold_winners, 1)} / ${fmt.num(a.hold_losers, 1)} d`} />
              </div>
              {a.disposition_flag && (
                <div className="mt-3 rounded border border-warn/50 bg-warn/10 p-3 text-sm">
                  Disposition effect warning: you hold losing trades {((a.hold_losers! / a.hold_winners! - 1) * 100).toFixed(0)}% longer than winners. Are your stops real?
                </div>
              )}
              <div className="mt-4">
                <h3 className="mb-1 text-xs text-muted">R-multiple per closed trade</h3>
                <SignedBars data={a.r_series ?? []} keys={[{ key: "r", name: "R" }]} yFmt={(v) => `${v.toFixed(1)}R`} height={160} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <GroupTable title="By setup" rows={a.by_setup} />
                <GroupTable title="By emotion at entry" rows={a.by_emotion} />
                <GroupTable title="By followed plan" rows={a.by_plan} />
                <GroupTable title="By weekday of entry" rows={a.by_weekday} />
              </div>
            </>
          )}
        </Async>
      </Panel>

      <Panel title="Trades" caption="Every trade, newest first. Click a row to edit or close it." info="P&L uses shares × price change. R uses the stop you set at entry, so moving your stop later does not flatter the number.">
        <Async q={trades} h={160}>
          {(rows) => rows.length === 0 ? <p className="text-sm text-muted">No trades yet. Log one from a ticker&apos;s Verdict panel or the form above.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="text-left text-xs text-muted">
                  {["Ticker", "Entry", "Price", "Stop", "Target", "Size", "Setup", "Emotion", "Plan", "Exit", "P&L", "R", "Days", ""].map((h) => <th key={h} className="py-1 font-normal">{h}</th>)}
                </tr></thead>
                <tbody className="num">
                  {rows.map((t) => (
                    <tr key={t.id} onClick={() => edit(t)} className="cursor-pointer border-t border-line hover:bg-panel-2" title={t.thesis}>
                      <td className="py-1.5 text-accent">{t.ticker}</td><td>{t.entry_date}</td><td>{t.entry.toFixed(2)}</td><td>{t.stop.toFixed(2)}</td>
                      <td>{t.target?.toFixed(2) ?? "—"}</td><td>{t.size}</td><td className="font-sans">{t.setup}</td><td className="font-sans">{t.emotion}</td>
                      <td>{t.followed_plan == null ? "—" : t.followed_plan ? "Y" : "N"}</td><td>{t.exit?.toFixed(2) ?? "open"}</td>
                      <td className={t.pnl == null ? "" : t.pnl >= 0 ? "text-up" : "text-down"}>{fmt.big(t.pnl)}</td>
                      <td className={t.r_multiple == null ? "" : t.r_multiple >= 0 ? "text-up" : "text-down"}>{fmt.num(t.r_multiple, 2)}</td>
                      <td>{t.hold_days ?? "—"}</td>
                      <td><button onClick={(e) => { e.stopPropagation(); remove(t.id); }} aria-label="Delete" className="text-muted hover:text-down"><Trash2 className="size-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
        <Note>Journal entries are stored in the engine&apos;s SQLite file (engine/data/desk.db) on your computer.</Note>
      </Panel>
    </div>
  );
}
