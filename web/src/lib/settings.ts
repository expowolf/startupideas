"use client";
import { useEffect, useState } from "react";

export const COMPONENTS = [
  { key: "technicals", label: "Technicals" },
  { key: "earnings", label: "Earnings catalyst" },
  { key: "macro", label: "Macro regime" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "valuation", label: "Valuation" },
] as const;
export type Weights = Record<(typeof COMPONENTS)[number]["key"], number>;
export const DEFAULT_WEIGHTS: Weights = { technicals: 30, earnings: 25, macro: 15, fundamentals: 15, valuation: 15 };
export const SETUPS = ["PEAD", "pullback", "breakout", "other"] as const;
export const EMOTIONS = ["calm", "FOMO", "revenge", "bored", "confident", "anxious"] as const;

const KEY = "swingdesk.weights";

export function useWeights() {
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS);
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setW({ ...DEFAULT_WEIGHTS, ...JSON.parse(s) });
    } catch {}
  }, []);
  const save = (next: Weights) => {
    setW(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  return { weights: w, save };
}
