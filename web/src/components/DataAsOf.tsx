"use client";
import { MODE, REPO, useSnapshotIndex } from "@/lib/engine";

/** Snapshot mode: when the nightly data was built, linking to the Action that builds it. */
export function DataAsOf() {
  const { idx, error } = useSnapshotIndex();
  if (MODE !== "snapshot") return null;
  const href = `https://github.com/${REPO}/actions/workflows/snapshot.yml`;
  const failed = idx ? Object.keys(idx.errors).length : 0;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="num text-[11px] text-muted hover:text-text" title={error ?? (failed ? `Some panels failed for: ${Object.keys(idx!.errors).join(", ")}` : "Nightly GitHub snapshot")}>
      {error ? "No snapshot yet" : idx ? `Data ${idx.generated_at.replace("T", " ").slice(0, 16)} UTC${failed ? " ·" + " " + failed + " with gaps" : ""}` : "…"}
    </a>
  );
}
