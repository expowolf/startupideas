import { TickerSearch } from "./TickerSearch";
import { RegimeBadge } from "./RegimeBadge";

export function TopBar() {
  return (
    <header className="flex h-12 items-center gap-4 border-b border-line px-4">
      <TickerSearch className="w-full max-w-sm" />
      <div className="ml-auto">
        <RegimeBadge />
      </div>
    </header>
  );
}
