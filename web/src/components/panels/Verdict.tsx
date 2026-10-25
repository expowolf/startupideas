"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { api } from "@/lib/engine";
import { COMPONENTS, EMOTIONS, SETUPS, useWeights } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Panel } from "../Panel";
import { Note } from "../ui";

type Comp = { score: number | null; reasons: { text: string; points: number; met: boolean | null }[] };
export type VerdictData = { components: Partial<Record<string, Comp>> };

const today = () => new Date().toISOString().slice(0, 10);

export function VerdictPanel({ v, ticker, last }: { v: VerdictData; ticker: string; last: number | null }) {
  const { weights } = useWeights();
  const scored = COMPONENTS.map((c) => ({ ...c, w: weights[c.key], comp: v.components[c.key] })).filter((c) => c.comp?.score != null);
  const wsum = scored.reduce((a, c) => a + c.w, 0);
  const total = wsum ? scored.reduce((a, c) => a + c.comp!.score! * c.w, 0) / wsum : null;

  const [f, setF] = useState({ entry: last?.toFixed(2) ?? "", stop: "", target: "", size: "", thesis: "", wrong_if: "", planned_exit_date: "", setup: "pullback", emotion: "calm" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const required = ["entry", "stop", "target", "size", "thesis", "wrong_if", "planned_exit_date"] as const;
  const missing = required.filter((k) => !f[k].trim());
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function log() {
    if (missing.length) return setMsg({ ok: false, text: "Fill in every field first. Writing it down is the point." });
    if (Number(f.stop) >= Number(f.entry)) return setMsg({ ok: false, text: "Invalidation price must be below entry for a long." });
    try {
      await api("/api/journal", {
        method: "POST",
        body: JSON.stringify({ ticker, entry_date: today(), entry: +f.entry, stop: +f.stop, target: +f.target, size: +f.size, thesis: f.thesis, wrong_if: f.wrong_if, planned_exit_date: f.planned_exit_date, setup: f.setup, emotion: f.emotion }),
      });
      setMsg({ ok: true, text: "Logged to the journal." });
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    }
  }

  const risk = f.stop.trim() && f.entry.trim() ? +f.entry - +f.stop : 0;
  const rr = risk > 0 && +f.target ? (+f.target - +f.entry) / risk : null;
  const input = "w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <Panel
      title="Verdict"
      caption="Score the setup, then write down the thesis, what proves you wrong, and the exit before you trade."
      info="Each component is 0-100 from the transparent rules listed under it. The total is the weighted average of the components with data (weights in Settings: default technicals 30, earnings 25, macro 15, fundamentals 15, valuation 15). It is a checklist, not a forecast."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="num text-4xl">{total == null ? "—" : total.toFixed(0)}</span>
            <span className="text-sm text-muted">/ 100 weighted score</span>
          </div>
          <div className="space-y-3">
            {COMPONENTS.map((c) => {
              const comp = v.components[c.key];
              return (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{c.label} <span className="text-xs text-muted">({weights[c.key]}%)</span></span>
                    <span className="num">{comp?.score == null ? "no data" : comp.score.toFixed(0)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-panel-2">
                    <div className="h-full rounded bg-accent" style={{ width: `${comp?.score ?? 0}%` }} />
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {comp?.reasons.map((r) => (
                      <li key={r.text} className="flex items-center gap-1.5 text-xs text-muted">
                        {r.met === true ? <Check className="size-3 text-up" /> : r.met === false ? <X className="size-3 text-down" /> : <Minus className="size-3" />}
                        {r.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <Note><Link href="/settings" className="text-accent hover:underline">Edit weights</Link></Note>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-muted">Thesis<textarea rows={2} className={input} value={f.thesis} onChange={set("thesis")} placeholder="Why this, why now?" /></label>
          <label className="block text-xs text-muted">What proves me wrong<textarea rows={2} className={input} value={f.wrong_if} onChange={set("wrong_if")} placeholder="The specific event or price action that kills the idea" /></label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted">Entry<input className={cn(input, "num")} value={f.entry} onChange={set("entry")} inputMode="decimal" /></label>
            <label className="text-xs text-muted">Invalidation price<input className={cn(input, "num")} value={f.stop} onChange={set("stop")} inputMode="decimal" /></label>
            <label className="text-xs text-muted">Target<input className={cn(input, "num")} value={f.target} onChange={set("target")} inputMode="decimal" /></label>
            <label className="text-xs text-muted">Size (shares)<input className={cn(input, "num")} value={f.size} onChange={set("size")} inputMode="decimal" /></label>
            <label className="text-xs text-muted">Planned exit date<input type="date" className={input} value={f.planned_exit_date} onChange={set("planned_exit_date")} /></label>
            <label className="text-xs text-muted">Setup<select className={input} value={f.setup} onChange={set("setup")}>{SETUPS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-xs text-muted">Emotion right now<select className={input} value={f.emotion} onChange={set("emotion")}>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <div className="num flex flex-wrap gap-4 text-xs text-muted">
            <span>Risk/share {risk > 0 ? `$${risk.toFixed(2)}` : "—"}</span>
            <span>Reward:risk {rr == null ? "—" : `${rr.toFixed(1)}R`}</span>
            <span>$ at risk {risk > 0 && +f.size ? `$${(risk * +f.size).toFixed(0)}` : "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={log} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90">Log as trade</button>
            {msg && <span className={cn("text-xs", msg.ok ? "text-up" : "text-down")}>{msg.text}</span>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
