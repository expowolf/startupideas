"use client";
import { useEffect, useState } from "react";
import * as journal from "./localJournal";

/**
 * Two ways to get data:
 *  - live:     NEXT_PUBLIC_ENGINE_URL points at a running engine (your computer or a tunnel).
 *  - snapshot: no engine URL set. Reads the nightly JSON the GitHub Action publishes to the
 *              repo's `data` branch; the journal lives in this browser.
 */
export const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "";
export const MODE: "live" | "snapshot" = ENGINE_URL ? "live" : "snapshot";
export const REPO = process.env.NEXT_PUBLIC_REPO ?? "expowolf/startupideas";
export const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL ?? `https://raw.githubusercontent.com/${REPO}/data`;

export type Bar = { Date: string; Open: number; High: number; Low: number; Close: number; Volume: number };
export type Point = { date: string; value: number };

export class NotInSnapshot extends Error {}

async function liveApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    throw new Error(typeof d === "string" ? d : d ? JSON.stringify(d) : `Engine returned ${res.status}`);
  }
  return body as T;
}

export async function dataFile<T>(file: string): Promise<T> {
  const res = await fetch(`${DATA_URL}/${file}`, { cache: "no-store" });
  if (res.status === 404) throw new NotInSnapshot(file);
  if (!res.ok) throw new Error(`Snapshot fetch failed (${res.status})`);
  const body = await res.json();
  if (body && typeof body === "object" && "_error" in body) throw new Error(`Nightly run could not build this panel: ${body._error}`);
  return body as T;
}

const PER_TICKER = new Set(["prices", "technicals", "earnings", "valuation", "options", "sentiment", "traps", "verdict"]);

async function snapshotApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, "http://x");
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;

  if (parts[0] === "journal") {
    if (parts[1] === "analytics") return journal.analytics() as T;
    if (method === "POST") return journal.create(body) as T;
    if (method === "PUT") return journal.update(Number(parts[1]), body) as T;
    if (method === "DELETE") return journal.remove(Number(parts[1])) as T;
    return journal.list() as T;
  }
  if (parts[0] === "macro" || parts[0] === "regime") return dataFile<T>(`${parts[0]}.json`);
  if (parts[0] === "backtest") {
    if (parts[1] === "variants") return dataFile<T>("backtests/variant_counts.json").catch(() => ({}) as T);
    throw new Error("Backtests run as a GitHub Action in snapshot mode (see the Lab page).");
  }
  const t = (parts[1] ?? "").toUpperCase();
  const name = parts[0] === "fundamentals" ? `fundamentals_${url.searchParams.get("freq") ?? "quarterly"}` : parts[0];
  if (!PER_TICKER.has(parts[0]) && parts[0] !== "fundamentals") throw new Error(`Unknown endpoint ${path}`);
  try {
    return await dataFile<T>(`${t}/${name}.json`);
  } catch (e) {
    if (e instanceof NotInSnapshot) throw new NotInSnapshot(`${t} is not in the nightly snapshot yet. Add it to watchlist.txt in the repo; the next run after the US close will include it.`);
    throw e;
  }
}

export function api<T>(path: string, init?: RequestInit): Promise<T> {
  return MODE === "live" ? liveApi<T>(path, init) : snapshotApi<T>(path, init);
}

export async function getPrices(ticker: string): Promise<Bar[]> {
  return (await api<{ bars: Bar[] }>(`/api/prices/${encodeURIComponent(ticker)}`)).bars;
}

export type SnapshotIndex = { generated_at: string; tickers: string[]; requested: string[]; errors: Record<string, Record<string, string>> };

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

/** The snapshot's index.json (null in live mode). */
export function useSnapshotIndex() {
  const [idx, setIdx] = useState<SnapshotIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (MODE !== "snapshot") return;
    dataFile<SnapshotIndex>("index.json").then(setIdx, (e) =>
      setError(e instanceof NotInSnapshot ? "No snapshot published yet. Run the 'Nightly data snapshot' Action once on GitHub." : String(e.message)),
    );
  }, []);
  return { idx, error };
}
