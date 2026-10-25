"use client";
import { useEffect, useState } from "react";

// Engine runs on your machine (Yahoo blocks cloud IPs). On Vercel, point this at your tunnel URL.
export const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:8000";

export type Bar = { Date: string; Open: number; High: number; Low: number; Close: number; Volume: number };
export type Point = { date: string; value: number };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    throw new Error(typeof d === "string" ? d : d ? JSON.stringify(d) : `Engine returned ${res.status}`);
  }
  return body as T;
}

export async function getPrices(ticker: string): Promise<Bar[]> {
  return (await api<{ bars: Bar[] }>(`/api/prices/${encodeURIComponent(ticker)}`)).bars;
}

/** GET with loading/error state. Pass null to skip. `reload` re-fetches. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState({ data: null, error: null, loading: true });
    api<T>(path).then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState({ data: null, error: String(e?.message ?? e), loading: false }),
    );
    return () => {
      live = false;
    };
  }, [path, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
