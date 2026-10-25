"use client";
import { COMPONENTS, DEFAULT_WEIGHTS, useWeights } from "@/lib/settings";
import { Panel } from "@/components/Panel";

export default function SettingsPage() {
  const { weights, save } = useWeights();
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Panel title="Scorecard weights" caption="How much each component counts toward the verdict score. Saved in this browser." info="Defaults are tuned for swing trading: technicals 30, earnings 25, macro 15, fundamentals 15, valuation 15. The score is a weighted average, so weights need not add to 100, but keeping them at 100 makes them easy to read as percentages.">
        <div className="space-y-3">
          {COMPONENTS.map((c) => (
            <label key={c.key} className="flex items-center gap-3 text-sm">
              <span className="w-40">{c.label}</span>
              <input type="range" min={0} max={60} step={5} value={weights[c.key]} onChange={(e) => save({ ...weights, [c.key]: Number(e.target.value) })} className="flex-1 accent-[var(--accent)]" />
              <span className="num w-10 text-right">{weights[c.key]}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span className="num">Total {total}{total !== 100 && " (not 100: still works, read as relative weights)"}</span>
          <button onClick={() => save(DEFAULT_WEIGHTS)} className="text-accent hover:underline">Reset to defaults</button>
        </div>
      </Panel>
    </div>
  );
}
