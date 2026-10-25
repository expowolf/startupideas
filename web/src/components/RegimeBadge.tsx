"use client";
import { useApi } from "@/lib/engine";
import { cn } from "@/lib/utils";

type Regime = { label: "Risk-On" | "Neutral" | "Risk-Off"; asof: string; rules: { name: string; value: number; threshold: number; triggered: boolean }[]; definition: string };

/** Top-bar market regime. Hover shows the rule and today's inputs. */
export function RegimeBadge() {
  const { data, error } = useApi<Regime>("/api/regime");
  if (error) return <span className="rounded border border-line px-2 py-0.5 text-xs text-muted" title={error}>Regime: n/a</span>;
  if (!data) return <span className="h-5 w-24 animate-pulse rounded bg-panel-2" />;
  const color = data.label === "Risk-On" ? "text-up border-up/40" : data.label === "Risk-Off" ? "text-down border-down/40" : "text-muted border-line";
  return (
    <span className="group relative">
      <span className={cn("cursor-help rounded border px-2 py-0.5 text-xs", color)}>{data.label}</span>
      <span role="tooltip" className="absolute right-0 top-7 z-30 hidden w-80 rounded border border-line bg-panel-2 p-3 text-xs leading-relaxed group-hover:block">
        <span className="block whitespace-pre-line text-muted">{data.definition}</span>
        <span className="mt-2 block">Today ({data.asof}):</span>
        {data.rules.map((r) => (
          <span key={r.name} className="num block">
            {r.triggered ? "●" : "○"} {r.name}: {r.value.toFixed(2)} vs {r.threshold.toFixed(2)}
          </span>
        ))}
      </span>
    </span>
  );
}
