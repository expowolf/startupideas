"use client";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, DOWN, GRID, SERIES, UP } from "@/lib/palette";
import type { Point } from "@/lib/engine";

const axisProps = { stroke: AXIS, tick: { fill: AXIS, fontSize: 11 }, tickLine: false, axisLine: { stroke: GRID } } as const;
const tooltipStyle = {
  contentStyle: { background: "#172132", border: "1px solid #223049", borderRadius: 4, fontSize: 12 },
  labelStyle: { color: "#8592a6" },
  itemStyle: { color: "#e6ebf2" },
} as const;

export type Series = { name: string; points: Point[]; color?: string };

function merge(series: Series[]) {
  const m = new Map<string, Record<string, number | string>>();
  series.forEach((s) => s.points.forEach((p) => {
    const row = m.get(p.date) ?? { date: p.date };
    row[s.name] = p.value;
    m.set(p.date, row);
  }));
  return [...m.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** One y-axis line chart. Several series must share a unit (never dual-axis). */
export function LinesChart({ series, height = 200, yFmt = (v: number) => v.toFixed(1), xFmt = (d: string) => d.slice(0, 7), refs = [], band }: {
  series: Series[]; height?: number; yFmt?: (v: number) => string; xFmt?: (d: string) => string;
  refs?: { y: number; label: string }[]; band?: { from: number; to: number; label?: string };
}) {
  const data = merge(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" {...axisProps} minTickGap={32} tickFormatter={xFmt} />
        <YAxis {...axisProps} width={52} tickFormatter={yFmt} domain={["auto", "auto"]} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => yFmt(v)} labelFormatter={(d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : xFmt(d))} />
        {band && <ReferenceArea y1={band.from} y2={band.to} fill="#3a8fe8" fillOpacity={0.08} stroke="none" label={band.label ? { value: band.label, fill: AXIS, fontSize: 10, position: "insideTopLeft" } : undefined} />}
        {refs.map((r) => <ReferenceLine key={r.label} y={r.y} stroke={AXIS} strokeDasharray="3 3" label={{ value: r.label, fill: AXIS, fontSize: 10, position: "insideBottomRight" }} />)}
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />}
        {series.map((s, i) => (
          <Line key={s.name} dataKey={s.name} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Bars colored by sign (direction), e.g. surprise or reaction %. */
export function SignedBars({ data, keys, height = 200, xKey = "date", yFmt = (v: number) => `${v.toFixed(0)}%` }: {
  data: Record<string, unknown>[]; keys: { key: string; name: string; muted?: boolean }[]; height?: number; xKey?: string; yFmt?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={(d: string) => String(d).slice(0, 7)} />
        <YAxis {...axisProps} width={48} tickFormatter={yFmt} />
        <ReferenceLine y={0} stroke={AXIS} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#ffffff08" }} formatter={(v: number) => yFmt(v)} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />}
        {keys.map((k) => (
          <Bar key={k.key} dataKey={k.key} name={k.name} radius={[3, 3, 0, 0]} isAnimationActive={false} fill={AXIS}>
            {data.map((d, i) => {
              const v = d[k.key] as number | null;
              return <Cell key={i} fill={v == null ? "transparent" : v >= 0 ? UP : DOWN} fillOpacity={k.muted ? 0.45 : 0.9} />;
            })}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-measure bars in a series color (magnitudes like revenue). */
export function PlainBars({ data, dataKey, height = 180, yFmt, color = SERIES[0], xKey = "date" }: {
  data: Record<string, unknown>[]; dataKey: string; height?: number; yFmt: (v: number) => string; color?: string; xKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={(d: string) => String(d).slice(0, 7)} />
        <YAxis {...axisProps} width={60} tickFormatter={yFmt} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#ffffff08" }} formatter={(v: number) => yFmt(v)} />
        <ReferenceLine y={0} stroke={AXIS} />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Equity curve area (one series). */
export function EquityChart({ points, height = 220, color = SERIES[0] }: { points: Point[]; height?: number; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" {...axisProps} minTickGap={48} tickFormatter={(d: string) => d.slice(0, 7)} />
        <YAxis {...axisProps} width={52} tickFormatter={(v: number) => v.toFixed(2)} domain={["auto", "auto"]} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${((v - 1) * 100).toFixed(1)}%`} />
        <ReferenceLine y={1} stroke={AXIS} strokeDasharray="3 3" />
        <Area dataKey="value" name="Equity" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
