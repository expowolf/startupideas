import { TickerSearch } from "@/components/TickerSearch";

export default function Home() {
  return (
    <div className="relative -m-4 flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden">
      {/* Slow drifting glow: the only ambient animation in the app, and only on this screen. */}
      <div aria-hidden className="landing-glow absolute inset-0" />
      <div className="relative w-full max-w-md px-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          SWING<span className="text-accent">DESK</span>
        </h1>
        <p className="mt-2 text-sm text-muted">One ticker. Seven panels. A written verdict before every trade.</p>
        <TickerSearch className="mt-6 py-2.5" autoFocus />
      </div>
    </div>
  );
}
