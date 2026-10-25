// Engine runs on your machine (Yahoo blocks cloud IPs). On Vercel, point this at your tunnel URL.
export const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:8000";

export type Bar = { Date: string; Open: number; High: number; Low: number; Close: number; Volume: number };

export async function getPrices(ticker: string): Promise<Bar[]> {
  const res = await fetch(`${ENGINE_URL}/api/prices/${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? `Engine returned ${res.status}`);
  return (await res.json()).bars;
}
