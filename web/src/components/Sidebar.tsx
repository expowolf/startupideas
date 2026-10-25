"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, FlaskConical, NotebookPen, X } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Ticker", href: "/", icon: LineChart, ready: true },
  { label: "Journal", href: "/journal", icon: NotebookPen, ready: false, phase: 6 },
  { label: "Backtest Lab", href: "/lab", icon: FlaskConical, ready: false, phase: 7 },
];

export function Sidebar() {
  const path = usePathname();
  const { list, remove } = useWatchlist();
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-line bg-panel md:flex">
      <Link href="/" className="px-4 py-4 text-sm font-semibold tracking-wide">
        SWING<span className="text-accent">DESK</span>
      </Link>
      <nav className="px-2">
        {NAV.map(({ label, href, icon: Icon, ready, phase }) =>
          ready ? (
            <Link key={label} href={href} className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-panel-2", path === href && "bg-panel-2")}>
              <Icon className="size-4 text-muted" /> {label}
            </Link>
          ) : (
            <span key={label} title={`Arrives in phase ${phase}`} className="flex cursor-not-allowed items-center gap-2 px-2 py-1.5 text-sm text-muted/60">
              <Icon className="size-4" /> {label} <span className="ml-auto text-[10px]">P{phase}</span>
            </span>
          ),
        )}
      </nav>
      <h3 className="mt-6 px-4 pb-1 text-[11px] uppercase tracking-wider text-muted">Watchlist</h3>
      <ul className="px-2">
        {list.map((t) => (
          <li key={t} className="group flex items-center rounded hover:bg-panel-2">
            <Link href={`/t/${t}`} className={cn("num flex-1 px-2 py-1 text-sm text-accent", path === `/t/${t}` && "font-semibold")}>
              {t}
            </Link>
            <button onClick={() => remove(t)} aria-label={`Remove ${t}`} className="px-2 text-muted opacity-0 group-hover:opacity-100">
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
