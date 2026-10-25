"use client";
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Bar } from "@/lib/engine";
import { sma } from "@/lib/indicators";
import { Tabs } from "./Tabs";

const MAS = [
  { period: 20, color: "#f5b942" },
  { period: 50, color: "#3b9eff" },
  { period: 200, color: "#c084fc" },
] as const;
const RANGES = ["3M", "6M", "1Y", "5Y", "Max"] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number | null> = { "3M": 92, "6M": 183, "1Y": 365, "5Y": 1826, Max: null };

const ts = (d: string) => (Date.parse(d) / 1000) as UTCTimestamp;

export function PriceChart({ bars }: { bars: Bar[] }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const maSeries = useRef<Record<number, ISeriesApi<"Line">>>({});
  const [shown, setShown] = useState<Record<number, boolean>>({ 20: true, 50: true, 200: true });
  const [range, setRange] = useState<(typeof RANGES)[number]>("1Y");

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8592a6", fontFamily: "ui-monospace, Menlo, monospace" },
      grid: { vertLines: { color: "#1a2537" }, horzLines: { color: "#1a2537" } },
      rightPriceScale: { borderColor: "#223049" },
      timeScale: { borderColor: "#223049" },
      crosshair: { mode: 0 },
    });
    chart.current = c;

    const candles = c.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.22 } });
    candles.setData(bars.map((b) => ({ time: ts(b.Date), open: b.Open, high: b.High, low: b.Low, close: b.Close })));

    const vol = c.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(bars.map((b) => ({ time: ts(b.Date), value: b.Volume, color: b.Close >= b.Open ? "#22c55e55" : "#ef444455" })));

    const closes = bars.map((b) => b.Close);
    for (const { period, color } of MAS) {
      const s = c.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(sma(closes, period).flatMap((v, i) => (v === null ? [] : [{ time: ts(bars[i].Date), value: v }])));
      maSeries.current[period] = s;
    }
    return () => {
      c.remove();
      chart.current = null;
      maSeries.current = {};
    };
  }, [bars]);

  useEffect(() => {
    for (const { period } of MAS) maSeries.current[period]?.applyOptions({ visible: shown[period] });
  }, [shown, bars]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !bars.length) return;
    const days = RANGE_DAYS[range];
    if (days === null) return c.timeScale().fitContent();
    const last = ts(bars[bars.length - 1].Date);
    c.timeScale().setVisibleRange({ from: (last - days * 86400) as UTCTimestamp, to: last });
  }, [range, bars]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Tabs id="range" tabs={RANGES} value={range} onChange={setRange} />
        <div className="ml-auto flex gap-3 text-xs">
          {MAS.map(({ period, color }) => (
            <label key={period} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={shown[period]} onChange={() => setShown({ ...shown, [period]: !shown[period] })} className="accent-[var(--accent)]" />
              <span style={{ color }} className="num">MA{period}</span>
            </label>
          ))}
        </div>
      </div>
      <div ref={el} className="h-[420px] w-full" />
    </div>
  );
}
