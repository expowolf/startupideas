"use client";
import type { Point } from "@/lib/engine";
import { SERIES } from "@/lib/palette";
import { LinesChart } from "../charts";
import { Panel } from "../Panel";
import { fmt, Note, Stat, tone } from "../ui";

export type Tech = {
  summary: { last: number; pct_from_52w_high: number; high52_to_ath: number; atr14: number; atr_pct: number; stops: { atr_mult: number; price: number; pct: number }[]; rsi14: number };
  rs: Record<string, { etf: string; points?: Point[]; error?: string }>;
};

export function TechnicalsPanel({ t }: { t: Tech }) {
  const s = t.summary;
  const rs = Object.entries(t.rs).filter(([, v]) => v.points?.length);
  return (
    <Panel
      title="Technicals & stops"
      caption="Is it leading its market and sector, how close is it to its highs, and how wide does a stop need to be?"
      info="Relative strength = ticker price ÷ benchmark price, rebased to 100 a year ago; a rising line means it is outperforming. 52w-high/ATH near 1.0 means the yearly high is also near the all-time high (the condition where 52-week-high anchoring works best, see S3). ATR(14) is the average daily range; stops placed inside ~1.5 ATR tend to get hit by normal noise."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="From 52w high" value={fmt.pct(s.pct_from_52w_high)} tone={tone(s.pct_from_52w_high)} />
        <Stat label="52w high / ATH" value={fmt.num(s.high52_to_ath, 2)} hint="1.00 = the 52-week high is the all-time high" />
        <Stat label="ATR(14)" value={`${fmt.money(s.atr14)} · ${s.atr_pct.toFixed(1)}%`} />
        <Stat label="RSI(14)" value={fmt.num(s.rsi14, 0)} hint=">70 stretched, <30 washed out" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {s.stops.map((x) => (
          <Stat key={x.atr_mult} label={`Stop ${x.atr_mult}× ATR`} value={`${fmt.money(x.price)} (${x.pct.toFixed(1)}%)`} />
        ))}
      </div>
      {rs.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs text-muted">Relative strength (1 year, rebased to 100)</h3>
          <LinesChart series={rs.map(([k, v], i) => ({ name: `vs ${v.etf}${k === "sector" ? " (sector)" : ""}`, points: v.points!, color: SERIES[i] }))} refs={[{ y: 100, label: "even" }]} />
        </div>
      )}
      <Note>Sector ETF comes from the company&apos;s Yahoo sector (SPDR funds). Prices are split/dividend adjusted.</Note>
    </Panel>
  );
}
