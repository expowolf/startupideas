"use client";
import { LinesChart } from "../charts";
import { Panel } from "../Panel";
import { fmt, Note } from "../ui";
import type { Point } from "@/lib/engine";

type Metric = { label: string; available: boolean; current?: number; percentile?: number; bands?: Record<"p10" | "p25" | "p50" | "p75" | "p90", number>; points?: Point[]; since?: string };
export type Val = { metrics: Record<string, Metric>; note: string };

export function ValuationPanel({ v }: { v: Val }) {
  const ms = Object.values(v.metrics);
  return (
    <Panel
      title="Valuation vs own history"
      caption="Is it cheap or expensive compared with how the market has priced this same company? A high percentile means less room for error."
      info="Each line is the multiple through time; the shaded band is its 25th-75th percentile range and the dashed line the median. The percentile is where today's value ranks in that history (90th = more expensive than 90% of days). No peer comparisons: there is no clean free source."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {ms.map((m) =>
          m.available ? (
            <div key={m.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">{m.label}</span>
                <span className="num">{fmt.num(m.current, 1)}× · <span className="text-muted">{m.percentile!.toFixed(0)}th pct</span></span>
              </div>
              <LinesChart height={160} series={[{ name: m.label, points: m.points! }]} yFmt={(x) => x.toFixed(0)} band={{ from: m.bands!.p25, to: m.bands!.p75 }} refs={[{ y: m.bands!.p50, label: "median" }]} />
            </div>
          ) : (
            <div key={m.label} className="rounded border border-line p-3 text-xs text-muted">{m.label}: not meaningful (negative earnings/cash flow or too little history).</div>
          ),
        )}
      </div>
      <Note>{v.note}</Note>
    </Panel>
  );
}
