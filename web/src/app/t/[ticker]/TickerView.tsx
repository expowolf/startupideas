"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { getPrices, useApi, type Bar } from "@/lib/engine";
import { useWatchlist } from "@/lib/watchlist";
import { cn, pct } from "@/lib/utils";
import { Panel } from "@/components/Panel";
import { Tabs } from "@/components/Tabs";
import { CountUp } from "@/components/CountUp";
import { PriceChart, type Indicators } from "@/components/PriceChart";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { ErrorBox, Loading } from "@/components/ui";
import { TechnicalsPanel, type Tech } from "@/components/panels/Technicals";
import { EarningsPanel, type Earn } from "@/components/panels/Earnings";
import { FundamentalsPanel } from "@/components/panels/Fundamentals";
import { ValuationPanel, type Val } from "@/components/panels/Valuation";
import { OptionsPanel, type Opt } from "@/components/panels/Options";
import { MacroPanel } from "@/components/panels/Macro";
import { SentimentPanel, type Sent } from "@/components/panels/Sentiment";
import { TrapsPanel, type TrapData } from "@/components/panels/Traps";
import { VerdictPanel, type VerdictData } from "@/components/panels/Verdict";

const VIEWS = ["Engine chart", "TradingView"] as const;

/** Shows a skeleton or an error card until the panel's data arrives. */
function Slot<T>({ title, q, children }: { title: string; q: { data: T | null; error: string | null; loading: boolean }; children: (d: T) => ReactNode }) {
  if (q.data) return <>{children(q.data)}</>;
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {q.error ? <ErrorBox error={q.error} /> : <Loading h={160} />}
    </section>
  );
}

export function TickerView({ ticker }: { ticker: string }) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>("Engine chart");
  const { list, add } = useWatchlist();
  const money = useCallback((v: number) => `$${v.toFixed(2)}`, []);

  const tech = useApi<Tech & Indicators>(`/api/technicals/${ticker}`);
  const earn = useApi<Earn>(`/api/earnings/${ticker}`);
  const val = useApi<Val>(`/api/valuation/${ticker}`);
  const opt = useApi<Opt>(`/api/options/${ticker}`);
  const sent = useApi<Sent>(`/api/sentiment/${ticker}`);
  const traps = useApi<TrapData>(`/api/traps/${ticker}`);
  const verdict = useApi<VerdictData>(`/api/verdict/${ticker}`);

  useEffect(() => {
    setBars(null);
    setError(null);
    getPrices(ticker).then(setBars, (e) => setError(String(e.message ?? e)));
  }, [ticker]);

  const last = bars?.at(-1);
  const prev = bars?.at(-2);
  const dayChg = last && prev ? (last.Close / prev.Close - 1) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="num text-2xl font-semibold text-accent">{ticker}</h1>
        {last && (
          <>
            <div className="text-2xl"><CountUp value={last.Close} format={money} /></div>
            {dayChg !== null && <div className={cn("num text-sm", dayChg >= 0 ? "text-up" : "text-down")}>{pct(dayChg, 2)} 1D</div>}
            <div className="num text-xs text-muted">as of {last.Date}</div>
          </>
        )}
        {!list.includes(ticker) && (
          <button onClick={() => add(ticker)} className="ml-auto flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:text-text">
            <Plus className="size-3" /> Watchlist
          </button>
        )}
      </div>

      <Panel
        title="Price action"
        caption="Is the trend up, and where is price relative to its 20/50/200-day averages? Swing longs work best above a rising 50 and 200."
        info="Daily candles (split/dividend adjusted) with volume. A moving average (MA) is the mean close of the last N days: 20 ≈ one month, 50 ≈ one quarter, 200 ≈ one year. RSI measures recent up-moves vs down-moves on a 0-100 scale (RSI(2) is the very short version used by the reversal strategy). MACD is the gap between a fast and slow average; the histogram shows whether that gap is widening."
        actions={<Tabs id="view" tabs={VIEWS} value={view} onChange={setView} />}
      >
        {view === "TradingView" ? (
          <TradingViewWidget symbol={ticker} />
        ) : error ? (
          <ErrorBox error={error} />
        ) : bars ? (
          <PriceChart bars={bars} ind={tech.data} />
        ) : (
          <Loading h={460} />
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Slot title="Technicals & stops" q={tech}>{(d) => <TechnicalsPanel t={d} />}</Slot>
        <Slot title="Sentiment" q={sent}>{(d) => <SentimentPanel s={d} />}</Slot>
      </div>
      <Slot title="Earnings" q={earn}>{(d) => <EarningsPanel e={d} />}</Slot>
      <Slot title="Options" q={opt}>{(d) => <OptionsPanel o={d} />}</Slot>
      <FundamentalsPanel ticker={ticker} />
      <Slot title="Valuation" q={val}>{(d) => <ValuationPanel v={d} />}</Slot>
      <Slot title="Trap detector" q={traps}>{(d) => <TrapsPanel t={d} ticker={ticker} />}</Slot>
      <MacroPanel />
      <Slot title="Verdict" q={verdict}>{(d) => <VerdictPanel key={last?.Close ?? "none"} v={d} ticker={ticker} last={last?.Close ?? null} />}</Slot>
    </div>
  );
}
