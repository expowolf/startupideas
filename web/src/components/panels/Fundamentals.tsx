"use client";
import { useState } from "react";
import { useApi } from "@/lib/engine";
import { SERIES } from "@/lib/palette";
import { LinesChart, PlainBars } from "../charts";
import { Panel } from "../Panel";
import { Tabs } from "../Tabs";
import { Async, fmt, Note } from "../ui";

type Fund = {
  periods: { date: string; revenue: number | null; gross_margin: number | null; operating_margin: number | null; fcf: number | null; net_debt: number | null }[];
  divergences: { key: string; text: string; good: string[]; bad: string[] }[];
};
const FREQS = ["quarterly", "annual"] as const;

export function FundamentalsPanel({ ticker }: { ticker: string }) {
  const [freq, setFreq] = useState<(typeof FREQS)[number]>("quarterly");
  const q = useApi<Fund>(`/api/fundamentals/${ticker}?freq=${freq}`);
  return (
    <Panel
      title="Fundamentals"
      caption="Is the business growing, and is the growth turning into cash? Watch for revenue and cash flow moving in opposite directions."
      info="Free cash flow = operating cash flow − capital expenditure. Net debt = total debt − cash (negative = net cash). Margins are % of revenue. yfinance returns roughly 4-5 quarters and 4 fiscal years."
      actions={<Tabs id="freq" tabs={FREQS} value={freq} onChange={setFreq} />}
    >
      <Async q={q} h={260}>
        {(d) => {
          const pts = (k: keyof Fund["periods"][number]) => d.periods.filter((p) => p[k] != null).map((p) => ({ date: p.date, value: p[k] as number }));
          return (
            <>
              {d.divergences.map((v) => (
                <div key={v.key} className="mb-3 rounded border border-warn/50 bg-warn/10 p-3 text-sm">
                  <p className="font-medium">{v.text}</p>
                  <div className="mt-1 grid gap-2 text-xs sm:grid-cols-2">
                    <div><span className="text-muted">Could be fine:</span> {v.good.join("; ")}</div>
                    <div><span className="text-muted">Could be trouble:</span> {v.bad.join("; ")}</div>
                  </div>
                </div>
              ))}
              <div className="grid gap-4 lg:grid-cols-2">
                <div><h3 className="mb-1 text-xs text-muted">Revenue</h3><PlainBars data={d.periods} dataKey="revenue" yFmt={fmt.big} /></div>
                <div><h3 className="mb-1 text-xs text-muted">Margins (%)</h3>
                  <LinesChart height={180} yFmt={(v) => `${v.toFixed(0)}%`} series={[{ name: "Gross", points: pts("gross_margin"), color: SERIES[0] }, { name: "Operating", points: pts("operating_margin"), color: SERIES[1] }]} /></div>
                <div><h3 className="mb-1 text-xs text-muted">Free cash flow</h3><PlainBars data={d.periods} dataKey="fcf" yFmt={fmt.big} color={SERIES[3]} /></div>
                <div><h3 className="mb-1 text-xs text-muted">Net debt</h3><PlainBars data={d.periods} dataKey="net_debt" yFmt={fmt.big} color={SERIES[2]} /></div>
              </div>
              <Note>Divergence checks compare the latest period with the same period a year earlier.</Note>
            </>
          );
        }}
      </Async>
    </Panel>
  );
}
