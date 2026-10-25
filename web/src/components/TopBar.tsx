import { TickerSearch } from "./TickerSearch";
import { RegimeBadge } from "./RegimeBadge";
import { DataAsOf } from "./DataAsOf";

export function TopBar() {
  return (
    <header className="flex h-12 items-center gap-4 border-b border-line px-4">
      <TickerSearch className="w-full max-w-sm" />
      <div className="ml-auto flex items-center gap-3">
        <DataAsOf />
        <RegimeBadge />
      </div>
    </header>
  );
}
