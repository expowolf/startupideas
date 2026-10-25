"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getPrices, type Bar, ENGINE_URL } from "@/lib/engine";
import { useWatchlist } from "@/lib/watchlist";
import { cn, pct } from "@/lib/utils";
import { Panel } from "@/components/Panel";
import { Tabs } from "@/components/Tabs";
import { CountUp } from "@/components/CountUp";
import { PriceChart } from "@/components/PriceChart";
import { TradingViewWidget } from "@/components/TradingViewWidget";

const VIEWS = ["Engine chart", "TradingView"] as const;

export function TickerView({ ticker }: { ticker: string }) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>("Engine chart");
  const { list, add } = useWatchlist();
  const money = useCallback((v: number) => `$${v.toFixed(2)}`, []);

  useEffect(() => {
    setBars(null);
    setError(null);
    getPrices(ticker).then(setBars, (e) => setError(String(e.message ?? e)));
  }, [ticker]);

  const last = bars?.at(-1);
  const prev = bars?.at(-2);
  const dayChg = last && prev ? (last.Close / prev.Close - 1) * 100 : null;
  const high52 = bars ? Math.max(...bars.slice(-252).map((b) => b.High)) : null;
  const fromHigh = last && high52 ? (last.Close / high52 - 1) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="num text-2xl font-semibold text-accent">{ticker}</h1>
        {last && (
          <>
            <div className="text-2xl"><CountUp value={last.Close} format={money} /></div>
            {dayChg !== null && <div className={cn("num text-sm", dayChg >= 0 ? "text-up" : "text-down")}>{pct(dayChg, 2)} 1D</div>}
            {fromHigh !== null && (
              <div className="num text-sm text-muted" title="How far the last close sits below the highest high of the past 252 trading days">
                {pct(fromHigh)} from 52w high
              </div>
            )}
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
        info="Daily candles (split/dividend adjusted) with volume. A moving average (MA) is the mean close of the last N days: 20 ≈ one month, 50 ≈ one quarter, 200 ≈ one year. Price above the 200-day MA is the classic definition of a long-term uptrend."
        actions={<Tabs id="view" tabs={VIEWS} value={view} onChange={setView} />}
      >
        {view === "TradingView" ? (
          <TradingViewWidget symbol={ticker} />
        ) : error ? (
          <div className="rounded border border-down/40 bg-down/5 p-4 text-sm">
            <p className="text-down">Could not load {ticker} from the engine.</p>
            <p className="mt-1 text-muted">{error}</p>
            <p className="mt-2 text-xs text-muted">
              Is the engine running at <span className="num">{ENGINE_URL}</span>? Start it with <span className="num">uvicorn app.main:app --port 8000</span> from <span className="num">engine/</span>.
            </p>
          </div>
        ) : bars ? (
          <PriceChart bars={bars} />
        ) : (
          <div className="h-[460px] animate-pulse rounded bg-panel-2" aria-label="Loading prices" />
        )}
      </Panel>
    </div>
  );
}
