"use client";
import { AlertTriangle } from "lucide-react";
import { SignedBars } from "../charts";
import { Panel } from "../Panel";
import { fmt, Note } from "../ui";

export type Earn = {
  quarters: { date: string; timing: string; estimate: number | null; actual: number; surprise_pct: number | null; ret_1d: number; ret_5d: number | null }[];
  coverage: { reported: number; with_estimate: number };
  next_date: string | null; days_to_next: number | null; inside_hold_window: boolean; hold_window_days: number;
};

export function EarningsPanel({ e }: { e: Earn }) {
  const q = e.quarters.slice(-12);
  return (
    <Panel
      title="Earnings"
      caption="Does this company beat, and does the stock follow through after it does? Beats that fade are a warning sign."
      info="Surprise % = (actual EPS − consensus estimate) ÷ |estimate|. Reaction = return from the close before the report to the close of the first session that traded on it (1D) and four sessions later (5D). Post-earnings drift (S1) needs both a beat and an up reaction."
    >
      {e.inside_hold_window && (
        <div className="mb-3 flex items-center gap-2 rounded border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
          <AlertTriangle className="size-4 text-warn" />
          Next earnings {e.next_date} is {e.days_to_next} days away — inside a typical {e.hold_window_days}-day hold. A swing entry now is also an earnings bet.
        </div>
      )}
      {q.length === 0 ? (
        <p className="text-sm text-muted">yfinance returned no reported quarters for this ticker.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs text-muted">EPS surprise %</h3>
            <SignedBars data={q} keys={[{ key: "surprise_pct", name: "Surprise" }]} />
          </div>
          <div>
            <h3 className="mb-1 text-xs text-muted">Price reaction %</h3>
            <SignedBars data={q} keys={[{ key: "ret_1d", name: "Next day" }, { key: "ret_5d", name: "5 days", muted: true }]} />
          </div>
        </div>
      )}
      <Note>
        Coverage: {e.coverage.reported} reported quarters, {e.coverage.with_estimate} with an EPS estimate. Next report: {e.next_date ?? "unknown"}.
        {q.length > 0 && ` Last: ${q.at(-1)!.date} surprise ${fmt.pct(q.at(-1)!.surprise_pct)}, 1D ${fmt.pct(q.at(-1)!.ret_1d)}.`}
      </Note>
    </Panel>
  );
}
