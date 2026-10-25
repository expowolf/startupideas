"use client";
import { useEffect, useRef } from "react";

/**
 * TradingView's free embed widget. It shows TradingView's own data and stays read-only:
 * nothing from it reaches the scorecard or backtests (those use the engine's data).
 */
export function TradingViewWidget({ symbol }: { symbol: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = el.current;
    if (!host) return;
    host.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%"></div>';
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      symbol,
      interval: "D",
      theme: "dark",
      style: "1",
      autosize: true,
      backgroundColor: "#121a27",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      support_host: "https://www.tradingview.com",
    });
    host.appendChild(s);
    return () => {
      host.innerHTML = "";
    };
  }, [symbol]);
  return <div ref={el} className="tradingview-widget-container h-[460px] w-full" />;
}
