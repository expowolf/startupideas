import { TickerSearch } from "./TickerSearch";

// Market regime badge joins this bar in phase 4 (needs FRED data).
export function TopBar() {
  return (
    <header className="flex h-12 items-center gap-4 border-b border-line px-4">
      <TickerSearch className="w-full max-w-sm" />
    </header>
  );
}
