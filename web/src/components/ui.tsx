"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ENGINE_URL } from "@/lib/engine";

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "up" | "down" | null }) {
  return (
    <div className="rounded border border-line bg-panel-2 px-3 py-2" title={hint}>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("num mt-0.5 text-base", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
    </div>
  );
}

export function Loading({ h = 200 }: { h?: number }) {
  return <div style={{ height: h }} className="animate-pulse rounded bg-panel-2" aria-label="Loading" />;
}

export function ErrorBox({ error }: { error: string }) {
  const offline = /fetch|network|Failed/i.test(error);
  return (
    <div className="rounded border border-line bg-panel-2 p-3 text-sm">
      <p className="text-muted">{offline ? "Engine not reachable." : "No data."}</p>
      <p className="mt-1 break-words text-xs text-muted/80">{error}</p>
      {offline && (
        <p className="mt-2 text-xs text-muted">
          Start it: <span className="num">cd engine && uvicorn app.main:app --port 8000</span> (expected at <span className="num">{ENGINE_URL}</span>)
        </p>
      )}
    </div>
  );
}

/** Renders loading/error states, otherwise children(data). */
export function Async<T>({ q, h, children }: { q: { data: T | null; error: string | null; loading: boolean }; h?: number; children: (d: T) => ReactNode }) {
  if (q.loading) return <Loading h={h} />;
  if (q.error) return <ErrorBox error={q.error} />;
  return q.data ? <>{children(q.data)}</> : null;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-muted">{children}</p>;
}

export const fmt = {
  pct: (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`),
  num: (v: number | null | undefined, d = 2) => (v == null ? "—" : v.toFixed(d)),
  money: (v: number | null | undefined) => (v == null ? "—" : `$${v.toFixed(2)}`),
  big: (v: number | null | undefined) => {
    if (v == null) return "—";
    const a = Math.abs(v);
    const s = a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a.toFixed(0);
    return `${v < 0 ? "-" : ""}$${s}`;
  },
};

export const tone = (v: number | null | undefined) => (v == null ? null : v >= 0 ? "up" : "down");
