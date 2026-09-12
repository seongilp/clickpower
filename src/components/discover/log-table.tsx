"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogRow } from "@/lib/query/types";
import { formatTs, chTsToMs } from "@/lib/time";
import { levelColor } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { LevelBadge } from "./level-badge";
import { getPath } from "./json-tree";

type Props = {
  rows: LogRow[];
  columns: string[];
  highlight: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
};

const ROW_H = 28;

export function LogTable({ rows, columns, highlight, selectedIndex, onSelect, onLoadMore, hasMore, loadingMore }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 20,
  });

  const items = virt.getVirtualItems();
  const last = items[items.length - 1];
  useEffect(() => {
    if (last && last.index >= rows.length - 1 && hasMore && !loadingMore) onLoadMore();
  }, [last, rows.length, hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "j" && e.key !== "k") return;
      const next = selectedIndex === null ? 0 : Math.min(Math.max(selectedIndex + (e.key === "j" ? 1 : -1), 0), rows.length - 1);
      onSelect(next);
      virt.scrollToIndex(next, { align: "auto" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, rows.length, onSelect, virt]);

  return (
    <div ref={parentRef} className="relative h-full overflow-auto font-mono text-xs">
      <div className="sticky top-0 z-10 flex h-7 items-center border-b bg-background/95 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
        <div className="w-48 shrink-0 px-3">time</div>
        <div className="w-16 shrink-0 px-1">level</div>
        {columns.map((c) => (
          <div key={c} className={cn("shrink-0 px-2", c === "message" ? "min-w-0 flex-1" : "w-36 truncate")}>{c}</div>
        ))}
      </div>
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {items.map((vi) => {
          const row = rows[vi.index];
          const top = vi.start;
          if (!row) {
            return (
              <div key="loader" className="absolute left-0 flex w-full items-center px-3 text-muted-foreground" style={{ top, height: ROW_H }}>
                {loadingMore ? "loading more…" : ""}
              </div>
            );
          }
          const selected = vi.index === selectedIndex;
          return (
            <div
              key={vi.key}
              data-testid="log-row"
              onClick={() => onSelect(vi.index)}
              className={cn(
                "absolute left-0 flex w-full cursor-pointer items-center border-b border-border/40 transition-colors hover:bg-accent/50",
                selected && "bg-primary/10 hover:bg-primary/15",
              )}
              style={{ top, height: ROW_H, boxShadow: `inset 2px 0 0 ${levelColor(row.level)}` }}
            >
              <div className="w-48 shrink-0 px-3 whitespace-nowrap text-muted-foreground tabular">{formatTs(chTsToMs(row.timestamp), { ms: true })}</div>
              <div className="w-16 shrink-0 px-1"><LevelBadge level={row.level} /></div>
              {columns.map((c) => (
                <div key={c} className={cn("shrink-0 truncate px-2", c === "message" ? "min-w-0 flex-1 text-foreground" : "w-36 text-muted-foreground")}>
                  <Highlight text={cellText(row, c)} terms={highlight} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {rows.length === 0 && !loadingMore && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">no logs in range</div>
      )}
    </div>
  );
}

function cellText(row: LogRow, col: string): string {
  const v = col in row ? (row as unknown as Record<string, unknown>)[col] : getPath(row.attributes, col);
  if (v === undefined || v === null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (re.test(p) && i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}
