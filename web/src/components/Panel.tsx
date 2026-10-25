"use client";
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible card. Every panel states what it tells you (caption) and explains the metric (info tooltip). */
export function Panel({
  title,
  caption,
  info,
  actions,
  children,
  className,
}: {
  title: string;
  caption: string;
  info: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-md border border-line bg-panel transition-shadow hover:shadow-[0_0_0_1px_var(--accent)]/20 hover:shadow-[0_0_24px_-12px_var(--accent)]",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="group relative">
          <Info className="size-3.5 text-muted" aria-label="About this metric" />
          <span
            role="tooltip"
            className="pointer-events-none absolute left-5 top-0 z-20 hidden w-72 rounded border border-line bg-panel-2 p-2.5 text-xs leading-relaxed text-text group-hover:block"
          >
            {info}
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"} className="text-muted hover:text-text">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
      </header>
      {open && (
        <>
          <p className="px-4 pt-2 text-xs text-muted">{caption}</p>
          <div className="p-4 pt-2">{children}</div>
        </>
      )}
    </motion.section>
  );
}
