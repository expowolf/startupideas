"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Segmented tab switch with an animated underline (the only motion it has). */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: readonly T[]; value: T; onChange: (t: T) => void; id: string }) {
  return (
    <div role="tablist" className="flex gap-1">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === value}
          onClick={() => onChange(t)}
          className={cn("relative px-2.5 py-1 text-xs", t === value ? "text-text" : "text-muted hover:text-text")}
        >
          {t}
          {t === value && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-1 -bottom-px h-0.5 bg-accent" />}
        </button>
      ))}
    </div>
  );
}
