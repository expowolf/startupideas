"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function TickerSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim().toUpperCase();
        if (/^[A-Z0-9.\-^=]{1,12}$/.test(t)) router.push(`/t/${t}`);
      }}
      className={cn("flex items-center gap-2 rounded border border-line bg-panel px-3 py-1.5 focus-within:border-accent", className)}
    >
      <Search className="size-4 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Ticker, e.g. NVDA"
        aria-label="Search ticker"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </form>
  );
}
