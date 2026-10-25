"use client";
import { Panel } from "../Panel";
import { fmt, Note, Stat, tone } from "../ui";

export type Sent = {
  vix: { value: number; date: string; percentile_1y: number } | null;
  crowd: { pct_above_sma50: number; days_above_sma50_of_last_50: number; gap_days: number; gap_window: number; gap_threshold_pct: number; volume_vs_avg50: number; streak: number };
};

export function SentimentPanel({ s }: { s: Sent }) {
  const c = s.crowd;
  return (
    <Panel
      title="Sentiment (price-based)"
      caption="Is the crowd fearful or euphoric, and is this stock being chased? Extremes are where reversals tend to start."
      info="VIX = the market's expected 30-day volatility from S&P 500 options; its 1-year percentile shows whether fear is high relative to the past year. The ticker signals come only from its own prices and volume. No put/call ratios, AAII survey or social sentiment: no free, reliable, documented source."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="VIX" value={s.vix ? fmt.num(s.vix.value, 1) : "—"} hint={s.vix ? `as of ${s.vix.date}` : "needs FRED key"} />
        <Stat label="VIX 1y percentile" value={s.vix ? `${s.vix.percentile_1y.toFixed(0)}th` : "—"} />
        <Stat label="vs 50-day avg" value={fmt.pct(c.pct_above_sma50)} tone={tone(c.pct_above_sma50)} hint={`${c.days_above_sma50_of_last_50}/50 recent days closed above it`} />
        <Stat label={`Gap days (${c.gap_window}d)`} value={c.gap_days} hint={`Opens more than ${c.gap_threshold_pct}% from prior close`} />
        <Stat label="Volume vs 50d avg" value={`${c.volume_vs_avg50.toFixed(2)}×`} />
        <Stat label="Streak" value={`${Math.abs(c.streak)} ${c.streak >= 0 ? "up" : "down"}`} tone={c.streak === 0 ? null : c.streak > 0 ? "up" : "down"} />
      </div>
      <Note>{c.days_above_sma50_of_last_50} of the last 50 sessions closed above the 50-day average.</Note>
    </Panel>
  );
}
