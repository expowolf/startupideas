"use client";
import { useApi, type Point } from "@/lib/engine";
import { SERIES } from "@/lib/palette";
import { LinesChart } from "../charts";
import { Panel } from "../Panel";
import { Async, Note } from "../ui";

type S = { points: Point[]; last: { date: string; value: number } | null };
type Macro = {
  missing: { id: string; error: string }[];
  curve: { now: { tenor: string; value: number }[]; year_ago: { tenor: string; value: number | null }[]; asof: string } | null;
  series: Record<string, S>;
};

const SMALL: [string, string, (v: number) => string][] = [
  ["DFF", "Fed funds rate", (v) => `${v.toFixed(2)}%`],
  ["CPI_YOY", "CPI YoY", (v) => `${v.toFixed(1)}%`],
  ["CORE_CPI_YOY", "Core CPI YoY", (v) => `${v.toFixed(1)}%`],
  ["UNRATE", "Unemployment", (v) => `${v.toFixed(1)}%`],
  ["ICSA", "Initial jobless claims", (v) => `${(v / 1000).toFixed(0)}k`],
  ["BAMLH0A0HYM2", "High-yield spread", (v) => `${v.toFixed(2)}%`],
  ["VIXCLS", "VIX", (v) => v.toFixed(1)],
];

export function MacroPanel() {
  const q = useApi<Macro>("/api/macro");
  return (
    <Panel
      title="Macro (FRED)"
      caption="Is the economy and credit market a tailwind or a headwind for owning stocks right now?"
      info="Yield curve: Treasury yields by maturity; when short rates sit above long rates (inverted, spreads below 0) it has historically preceded recessions, though with long and variable lags. High-yield spread = extra yield junk bonds pay over Treasuries; it widens when credit stress rises. All series from the St. Louis Fed (FRED)."
    >
      <Async q={q} h={300}>
        {(m) => (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {m.curve && (
                <div>
                  <h3 className="mb-1 text-xs text-muted">Yield curve (as of {m.curve.asof})</h3>
                  <LinesChart
                    height={180}
                    yFmt={(v) => `${v.toFixed(1)}%`}
                    xFmt={(d) => d.split(":")[1] ?? d}
                    series={[
                      { name: "Now", color: SERIES[0], points: m.curve.now.map((p, i) => ({ date: `${i}:${p.tenor}`, value: p.value })) },
                      { name: "1 year ago", color: SERIES[1], points: m.curve.year_ago.filter((p) => p.value != null).map((p) => ({ date: `${m.curve!.year_ago.indexOf(p)}:${p.tenor}`, value: p.value! })) },
                    ]}
                  />
                </div>
              )}
              <div>
                <h3 className="mb-1 text-xs text-muted">Curve spreads (10Y−2Y, 10Y−3M), percentage points</h3>
                <LinesChart
                  height={180}
                  refs={[{ y: 0, label: "inverted below" }]}
                  yFmt={(v) => v.toFixed(1)}
                  series={[["T10Y2Y", "10Y−2Y"], ["T10Y3M", "10Y−3M"]].filter(([k]) => m.series[k]).map(([k, n], i) => ({ name: n, color: SERIES[i], points: m.series[k].points }))}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SMALL.filter(([k]) => m.series[k]).map(([k, label, f]) => (
                <div key={k} className="rounded border border-line p-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted">{label}</span>
                    <span className="num">{m.series[k].last ? f(m.series[k].last!.value) : "—"}</span>
                  </div>
                  <LinesChart height={90} series={[{ name: label, points: m.series[k].points }]} yFmt={f} />
                </div>
              ))}
            </div>
            {m.missing.length > 0 && <Note>Dropped (unavailable or no FRED key): {m.missing.map((x) => x.id).join(", ")}.</Note>}
            <Note>Time series show the last 10 years.</Note>
          </>
        )}
      </Async>
    </Panel>
  );
}
