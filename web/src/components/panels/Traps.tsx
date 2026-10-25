"use client";
import { Panel } from "../Panel";
import { Note } from "../ui";

type Rates = { breakout_fail_rate: number | null; sweeps_per_100_days: number | null; gap_fade_rate: number | null };
export type TrapData = {
  ticker: Rates & {
    breakouts: number; sweeps: number; gaps: number;
    recent: { gaps: { date: string; gap_pct: number; faded: boolean; headlines: { title: string; publisher: string; url: string }[] }[]; breakouts: { date: string; failed: boolean }[] };
  };
  baselines: Record<string, Rates>;
  headlines: { title: string; published: string; publisher: string; url: string }[];
  rules: Record<string, string>;
  window_years: number;
};

const ROWS: [keyof Rates, string, (v: number) => string][] = [
  ["breakout_fail_rate", "Breakouts that failed", (v) => `${v.toFixed(0)}%`],
  ["sweeps_per_100_days", "Stop sweeps per 100 days", (v) => v.toFixed(1)],
  ["gap_fade_rate", "Big gaps that faded", (v) => `${v.toFixed(0)}%`],
];

export function TrapsPanel({ t, ticker }: { t: TrapData; ticker: string }) {
  const cols: [string, Rates][] = [[ticker, t.ticker], ...Object.entries(t.baselines)];
  return (
    <Panel
      title="Trap detector"
      caption="Do obvious setups in this stock fail more often than in the market? If not, 'they hunt my stops' is not what's happening here."
      info="Measures outcomes, not intent: who caused a move cannot be seen without order-book data. Compare the ticker column with SPY and its sector ETF. A rate far above both suggests this stock punishes breakout-chasing or tight stops under swing lows; a similar rate means the failures are normal market noise."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-normal">Last {t.window_years} years</th>
              {cols.map(([n]) => <th key={n} className="py-1 text-right font-normal">{n}</th>)}
            </tr>
          </thead>
          <tbody className="num">
            {ROWS.map(([k, label, f]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-1.5 font-sans">{label}</td>
                {cols.map(([n, r]) => <td key={n} className="py-1.5 text-right">{r[k] == null ? "—" : f(r[k]!)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-muted">Sample: {t.ticker.breakouts} breakouts, {t.ticker.sweeps} sweeps, {t.ticker.gaps} gaps ≥3%.</p>

      {t.ticker.recent.gaps.length > 0 && (
        <>
          <h3 className="mb-1 mt-4 text-xs text-muted">Recent big gaps, with headlines published within a day</h3>
          <ul className="space-y-1.5 text-sm">
            {t.ticker.recent.gaps.slice().reverse().map((g) => (
              <li key={g.date} className="rounded border border-line px-2 py-1.5">
                <span className="num">{g.date}</span>{" "}
                <span className={g.gap_pct >= 0 ? "num text-up" : "num text-down"}>{g.gap_pct >= 0 ? "+" : ""}{g.gap_pct.toFixed(1)}%</span>{" "}
                <span className="text-xs text-muted">{g.faded ? "faded within 5 days" : "held"}</span>
                {g.headlines.map((h) => (
                  <a key={h.url} href={h.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-accent hover:underline">{h.title} — {h.publisher}</a>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
      <Note>
        Rules — breakout: {t.rules.breakout}. Sweep: {t.rules.sweep}. Gap: {t.rules.gap}. Yahoo only serves the latest ~10-20 headlines, so older gaps show none.
      </Note>
    </Panel>
  );
}
