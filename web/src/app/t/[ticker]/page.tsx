import { TickerView } from "./TickerView";

export default async function TickerPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return <TickerView ticker={ticker.toUpperCase()} />;
}
