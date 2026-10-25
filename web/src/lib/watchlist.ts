"use client";
import { useEffect, useState } from "react";

const KEY = "swingdesk.watchlist";
const DEFAULT = ["SPY", "AAPL", "MSFT"];

// Per-browser convenience only; the journal (phase 6) will live in SQLite.
export function useWatchlist() {
  const [list, setList] = useState<string[]>(DEFAULT);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setList(JSON.parse(saved));
    } catch {}
  }, []);
  const save = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  return {
    list,
    add: (t: string) => !list.includes(t) && save([...list, t]),
    remove: (t: string) => save(list.filter((x) => x !== t)),
  };
}
