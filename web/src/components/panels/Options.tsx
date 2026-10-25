"use client";
import { SERIES } from "@/lib/palette";
import { LinesChart } from "../charts";
import { Panel } from "../Panel";
import { fmt, Note, Stat } from "../ui";

export type Opt = {
  available: boolean; reason?: string; spot?: number; note?: string; skew_expiry?: string | null;
  term?: { expiry: string; dte: number; atm_iv: number }[];
  skew?: { strike: number; iv: number; side: string }[];
  expected_move?: { expiry: string; basis: string; earnings_date: string | null; straddle: number; move_pct: number; range: [number, number] } | null;
};

export function OptionsPanel({ o }: { o: Opt }) {
  if (!o.available) return <Panel title="Options" caption="What is the options market pricing?" info="Implied volatility from listed options."><p className="text-sm text-muted">{o.reason}</p></Panel>;
  const em = o.expected_move;
  return (
    <Panel
      title="Options (today only)"
      caption="How big a move is the options market pricing, and is downside protection unusually expensive?"
      info="ATM IV = implied volatility of the at-the-money strike: the market's forecast of annualized volatility. Term structure: IV by expiry; an upward spike at one expiry usually marks an event (earnings). Skew: IV by strike; puts priced above calls mean traders are paying up for crash protection. Expected move = price of the at-the-money straddle (call + put) as % of the stock. No IV history or IV rank: there is no free source."
    >
      {em && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label={`Expected move (${em.expiry})`} value={`±${em.move_pct.toFixed(1)}%`} hint={`Basis: ${em.basis}`} />
          <Stat label="Implied range" value={`${fmt.money(em.range[0])} – ${fmt.money(em.range[1])}`} />
          <Stat label="Earnings date" value={em.earnings_date ?? "—"} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs text-muted">ATM IV term structure (%)</h3>
          <LinesChart height={180} xFmt={(d) => d.slice(5)} series={[{ name: "ATM IV", points: (o.term ?? []).map((t) => ({ date: t.expiry, value: t.atm_iv })) }]} yFmt={(v) => `${v.toFixed(0)}%`} />
        </div>
        <div>
          <h3 className="mb-1 text-xs text-muted">Skew, {o.skew_expiry ?? "no monthly expiry"} (IV % by strike)</h3>
          <LinesChart
            height={180}
            yFmt={(v) => `${v.toFixed(0)}%`}
            xFmt={(d) => String(parseFloat(d))}
            series={[
              { name: "Puts (below spot)", color: SERIES[2], points: (o.skew ?? []).filter((s) => s.side === "put").map((s) => ({ date: s.strike.toFixed(1).padStart(9, "0"), value: s.iv })) },
              { name: "Calls (above spot)", color: SERIES[0], points: (o.skew ?? []).filter((s) => s.side === "call").map((s) => ({ date: s.strike.toFixed(1).padStart(9, "0"), value: s.iv })) },
            ]}
          />
        </div>
      </div>
      <Note>{o.note}</Note>
    </Panel>
  );
}
