"use client";
import { useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { api, useApi, type Point } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/Panel";
import { EquityChart } from "@/components/charts";
import { fmt, Note } from "@/components/ui";
import { SERIES } from "@/lib/palette";

type Key = "S1" | "S2" | "S3";
type Field = { key: string; label: string; options?: string[] };
const STRATS: Record<Key, { name: string; blurb: string; params: Field[]; defaults: Record<string, string>; exec: Record<string, string> }> = {
  S1: {
    name: "S1 · Post-earnings drift",
    blurb: "Buy day 2 after a positive EPS surprise that the market also bought on day 1. Exit on ATR stop, after N days, or before the next report. Expect it to be weak in large caps (Martineau 2022); compare cap buckets.",
    params: [{ key: "min_surprise", label: "Min surprise %" }],
    defaults: { min_surprise: "0" },
    exec: { stop_atr: "2", target_atr: "", trail_atr: "", max_hold: "10" },
  },
  S2: {
    name: "S2 · Pullback in uptrend",
    blurb: "Above the 200-day average, buy when RSI(2) is below a threshold or after 3+ down closes. Exit on a close above the 5-day average, after N days, or at the ATR stop. Profits tend to cluster after market selloffs (Nagel).",
    params: [{ key: "mode", label: "Trigger", options: ["rsi", "streak"] }, { key: "rsi_threshold", label: "RSI(2) below" }, { key: "down_days", label: "Down closes" }],
    defaults: { mode: "rsi", rsi_threshold: "10", down_days: "3" },
    exec: { stop_atr: "2.5", target_atr: "", trail_atr: "", max_hold: "5" },
  },
  S3: {
    name: "S3 · 52-week-high breakout",
    blurb: "Price near its 52-week high, which is itself near the all-time high; buy a close above the old high on 1.5× volume. Exit if it closes back below within 3 days, on a trailing ATR stop, or after N days (George & Hwang 2004).",
    params: [{ key: "near_pct", label: "Within % of 52w high" }, { key: "ath_pct", label: "52w high within % of ATH" }, { key: "vol_mult", label: "Volume × 50d avg" }, { key: "fail_days", label: "Failed-breakout days" }],
    defaults: { near_pct: "5", ath_pct: "10", vol_mult: "1.5", fail_days: "3" },
    exec: { stop_atr: "2", target_atr: "", trail_atr: "3", max_hold: "20" },
  },
};
const EXEC_LABELS: Record<string, string> = { stop_atr: "Stop (ATR ×)", target_atr: "Target (ATR ×, blank = none)", trail_atr: "Trailing stop (ATR ×, blank = none)", max_hold: "Max hold (days)", slippage_bps: "Slippage (bps/side)", commission_bps: "Commission (bps/side)" };

type M = Partial<Record<"trades" | "win_rate" | "avg_win_pct" | "avg_loss_pct" | "expectancy_r" | "profit_factor" | "t_stat" | "max_drawdown_pct" | "cagr_pct" | "sharpe" | "exposure_pct" | "total_return_pct", number | null>>;
type Result = {
  strategy: string; tickers: string[]; in_sample: M; out_of_sample: M;
  equity: { in_sample: Point[]; out_of_sample: Point[] };
  trades: { ticker: string; signal_date: string; entry_date: string; exit_date: string; entry: number; exit: number; reason: string; bars: number; ret_pct: number; r: number; sample: string }[];
  breakdowns: Record<string, ({ key: string } & M)[]>;
  regime_compare?: { without_filter: M; with_filter: M };
  walk_forward?: { folds: ({ fold: number; chosen: Record<string, unknown> } & M)[]; combined: M; grid_size: number };
  variants_tried: number; luck_odds_pct: number; verdict: { status: string; text: string };
  benchmarks: Record<string, M>; warnings: string[];
};

const ROWS: [keyof M, string, (v: number | null | undefined) => string][] = [
  ["trades", "Trades", (v) => (v == null ? "—" : String(v))],
  ["win_rate", "Win rate", (v) => (v == null ? "—" : `${v.toFixed(0)}%`)],
  ["avg_win_pct", "Avg win", (v) => fmt.pct(v)],
  ["avg_loss_pct", "Avg loss", (v) => fmt.pct(v)],
  ["expectancy_r", "Expectancy (R)", (v) => fmt.num(v, 2)],
  ["profit_factor", "Profit factor", (v) => fmt.num(v, 2)],
  ["t_stat", "t-stat (mean trade)", (v) => fmt.num(v, 2)],
  ["total_return_pct", "Total return", (v) => fmt.pct(v)],
  ["cagr_pct", "CAGR", (v) => fmt.pct(v)],
  ["max_drawdown_pct", "Max drawdown", (v) => fmt.pct(v)],
  ["sharpe", "Sharpe", (v) => fmt.num(v, 2)],
  ["exposure_pct", "Exposure", (v) => (v == null ? "—" : `${v.toFixed(0)}%`)],
];

function MetricTable({ cols }: { cols: [string, M][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-normal">Metric</th>{cols.map(([n]) => <th key={n} className="py-1 text-right font-normal">{n}</th>)}</tr></thead>
        <tbody className="num">
          {ROWS.filter(([k]) => cols.some(([, m]) => m[k] !== undefined)).map(([k, label, f]) => (
            <tr key={k} className="border-t border-line">
              <td className="py-1 font-sans">{label}</td>
              {cols.map(([n, m]) => <td key={n} className={cn("py-1 text-right", k === "t_stat" && m[k] != null && m[k]! < 3 && "text-warn")}>{f(m[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const input = "w-full rounded border border-line bg-panel-2 px-2 py-1 text-sm outline-none focus:border-accent";

export default function LabPage() {
  const [key, setKey] = useState<Key>("S2");
  const [params, setParams] = useState(STRATS.S2.defaults);
  const [exec, setExec] = useState<Record<string, string>>({ ...STRATS.S2.exec, slippage_bps: "5", commission_bps: "0" });
  const [tickers, setTickers] = useState("SPY, AAPL, MSFT");
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [oos, setOos] = useState("30");
  const [regime, setRegime] = useState("off");
  const [wf, setWf] = useState(false);
  const [grid, setGrid] = useState("rsi_threshold: 5, 10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const variants = useApi<Record<string, number>>("/api/backtest/variants");

  function pick(k: Key) {
    setKey(k); setParams(STRATS[k].defaults); setExec({ ...STRATS[k].exec, slippage_bps: exec.slippage_bps, commission_bps: exec.commission_bps });
    setGrid(k === "S1" ? "min_surprise: 0, 5" : k === "S2" ? "rsi_threshold: 5, 10" : "near_pct: 2, 5\nath_pct: 5, 10");
  }

  const parseVal = (v: string) => (v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v.trim());

  async function runIt() {
    setBusy(true); setErr(null);
    try {
      const gridObj = wf ? Object.fromEntries(grid.split("\n").filter((l) => l.includes(":")).map((l) => {
        const [k, vs] = l.split(":");
        return [k.trim(), vs.split(",").map(parseVal)];
      })) : null;
      const body = {
        strategy: key,
        params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, parseVal(v)])),
        exec: Object.fromEntries(Object.entries(exec).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)])),
        tickers: csv ? [] : tickers.split(/[,\s]+/).filter(Boolean),
        csv: csv?.text ?? null,
        oos_frac: Number(oos) / 100,
        regime, walk_forward: wf, grid: gridObj,
      };
      setRes(await api<Result>("/api/backtest", { method: "POST", body: JSON.stringify(body) }));
      variants.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const s = STRATS[key];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Backtest lab</h1>
      <Panel title="Setup" caption="Pick a strategy, set its parameters, choose data. Every distinct setting you try is counted." info="Signals use the close of day t and fill at the open of day t+1 (no look-ahead). The last part of the data (default 30%) is held out: it is only scored, never used to choose settings. Walk-forward re-picks the best grid setting on expanding windows inside the in-sample part and scores it on the next window.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STRATS) as Key[]).map((k) => (
            <button key={k} onClick={() => pick(k)} className={cn("rounded border px-3 py-1.5 text-sm", k === key ? "border-accent text-text" : "border-line text-muted hover:text-text")}>{STRATS[k].name}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{s.blurb}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {s.params.map((p) => (
            <label key={p.key} className="text-xs text-muted">{p.label}
              {p.options ? (
                <select className={input} value={params[p.key]} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}>{p.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input className={cn(input, "num")} value={params[p.key]} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })} />
              )}
            </label>
          ))}
          {Object.keys(EXEC_LABELS).map((k) => (
            <label key={k} className="text-xs text-muted">{EXEC_LABELS[k]}<input className={cn(input, "num")} value={exec[k] ?? ""} onChange={(e) => setExec({ ...exec, [k]: e.target.value })} /></label>
          ))}
          <label className="text-xs text-muted">Held-out % (out of sample)<input className={cn(input, "num")} value={oos} onChange={(e) => setOos(e.target.value)} /></label>
          <label className="text-xs text-muted">S4 regime filter
            <select className={input} value={regime} onChange={(e) => setRegime(e.target.value)}>
              <option value="off">off</option><option value="on">on (skip Risk-Off days)</option><option value="compare">compare with vs without</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <label className="text-xs text-muted">Tickers (comma separated; mix market caps for S1)
            <input className={input} value={tickers} onChange={(e) => setTickers(e.target.value)} disabled={!!csv} />
          </label>
          <div className="text-xs text-muted">Or upload OHLCV CSV (Date, Open, High, Low, Close, Volume)
            <div className="mt-1 flex items-center gap-2">
              <input type="file" accept=".csv,text/csv" className="text-xs" onChange={async (e) => { const file = e.target.files?.[0]; setCsv(file ? { name: file.name, text: await file.text() } : null); }} />
              {csv && <button onClick={() => setCsv(null)} className="text-accent">clear {csv.name}</button>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wf} onChange={(e) => setWf(e.target.checked)} className="accent-[var(--accent)]" /> Walk-forward</label>
          {wf && <label className="text-xs text-muted">Grid (one parameter per line, values comma separated)<textarea rows={2} className={cn(input, "num w-72")} value={grid} onChange={(e) => setGrid(e.target.value)} /></label>}
          <button onClick={runIt} disabled={busy} className="ml-auto flex items-center gap-2 rounded bg-accent px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-60">
            <FlaskConical className="size-4" /> {busy ? "Running…" : "Run backtest"}
          </button>
        </div>
        {variants.data && <Note>Variants tried so far: {Object.entries(variants.data).map(([k, n]) => `${k} ${n}`).join(" · ") || "none"}.</Note>}
        {err && <p className="mt-2 text-sm text-down">{err}</p>}
      </Panel>

      {res && (
        <>
          <div className={cn("rounded-md border p-4", res.verdict.status === "passes_hurdle" ? "border-up/40 bg-up/5" : "border-warn/50 bg-warn/10")}>
            <p className="font-medium">{res.verdict.text}</p>
            <p className="mt-1 text-sm text-muted">
              {res.variants_tried} variants of {res.strategy} tried so far. With that many tries, the chance that at least one looks significant (t &gt; 2) by pure luck is about {res.luck_odds_pct.toFixed(0)}%. The best result you have seen is inflated by that search.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {res.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-warn" />{w}</li>)}
            </ul>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="In-sample vs out-of-sample" caption="Only the out-of-sample column is evidence. In-sample numbers are what you tuned on." info="Expectancy (R) = average trade result in units of initial risk. Profit factor = gross wins ÷ gross losses. t-stat = mean trade return ÷ its standard error; below 3.0 is flagged (Harvey, Liu & Zhu 2016). Exposure = share of days in a trade.">
              <MetricTable cols={[["In-sample", res.in_sample], ["Out-of-sample", res.out_of_sample], ...Object.entries(res.benchmarks).map(([k, m]) => [`${k} buy & hold (OOS)`, m] as [string, M])]} />
            </Panel>
            <Panel title="Equity curve (out of sample)" caption="Growth of $1 in the held-out period, equal-weighted across tickers." info="Each ticker is traded on its own; the curve is the average of their equity curves. Compare its shape with buy-and-hold: a strategy can beat on Sharpe while losing on total return because it sits in cash.">
              <EquityChart points={res.equity.out_of_sample} />
              <h3 className="mb-1 mt-3 text-xs text-muted">In-sample (for reference)</h3>
              <EquityChart points={res.equity.in_sample} height={120} color={SERIES[1]} />
            </Panel>
          </div>

          {res.regime_compare && (
            <Panel title="S4 regime filter: with vs without" caption="Does skipping Risk-Off days improve the out-of-sample result, or just cut the trade count?" info="Same strategy and settings; the filtered version ignores entry signals on days the regime badge rule reads Risk-Off.">
              <MetricTable cols={[["Without filter", res.regime_compare.without_filter], ["With filter", res.regime_compare.with_filter]]} />
            </Panel>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {Object.entries(res.breakdowns).filter(([, rows]) => rows.length > 1).map(([k, rows]) => (
              <Panel key={k} title={`Out-of-sample by ${k === "cap" ? "market cap" : k === "market" ? "market condition" : "regime"}`} caption={k === "market" ? "Reversal profits are said to cluster after selloffs. Do they here?" : k === "cap" ? "Drift is said to survive mainly in small caps. Does it here?" : "How trades did by the regime on their signal day."} info="Groups with few trades are mostly noise; check the Trades column before reading anything into a difference.">
                <MetricTable cols={rows.map((r) => [r.key, r] as [string, M])} />
              </Panel>
            ))}
          </div>

          {res.walk_forward && (
            <Panel title="Walk-forward (inside in-sample)" caption="If the chosen settings jump around fold to fold, the 'best' setting is noise." info={`Expanding windows; at each fold the best of ${res.walk_forward.grid_size} grid settings (by expectancy, min 10 trades) is chosen on past data and scored on the next window.`}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="font-normal">Fold</th><th className="font-normal">Chosen</th><th className="text-right font-normal">Trades</th><th className="text-right font-normal">Exp. R</th><th className="text-right font-normal">t</th></tr></thead>
                <tbody className="num">
                  {res.walk_forward.folds.map((f) => (
                    <tr key={f.fold} className="border-t border-line"><td className="py-1">{f.fold}</td><td className="font-sans text-xs">{JSON.stringify(f.chosen)}</td><td className="text-right">{f.trades}</td><td className="text-right">{fmt.num(f.expectancy_r, 2)}</td><td className="text-right">{fmt.num(f.t_stat, 2)}</td></tr>
                  ))}
                  <tr className="border-t border-line font-medium"><td className="py-1">All</td><td /><td className="text-right">{res.walk_forward.combined.trades}</td><td className="text-right">{fmt.num(res.walk_forward.combined.expectancy_r, 2)}</td><td className="text-right">{fmt.num(res.walk_forward.combined.t_stat, 2)}</td></tr>
                </tbody>
              </table>
            </Panel>
          )}

          <Panel title={`Trades (${res.trades.length})`} caption="Every simulated trade, out-of-sample first." info="Signal = the close that triggered it; entry fills the next open. Reason is why it exited: stop, target, signal, max_hold, failed_breakout or end_of_window.">
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-panel"><tr className="text-left text-xs text-muted">{["Set", "Ticker", "Signal", "Entry", "Exit", "In", "Out", "Days", "Return", "R", "Reason"].map((h) => <th key={h} className="py-1 font-normal">{h}</th>)}</tr></thead>
                <tbody className="num">
                  {res.trades.slice(0, 500).map((t, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1 text-xs text-muted">{t.sample}</td><td className="text-accent">{t.ticker}</td><td>{t.signal_date}</td><td>{t.entry_date}</td><td>{t.exit_date}</td>
                      <td>{t.entry.toFixed(2)}</td><td>{t.exit.toFixed(2)}</td><td>{t.bars}</td>
                      <td className={t.ret_pct >= 0 ? "text-up" : "text-down"}>{fmt.pct(t.ret_pct)}</td><td>{t.r.toFixed(2)}</td><td className="font-sans text-xs">{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
