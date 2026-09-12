"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PlayIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { StatsBar } from "./stats-bar";

type Props = { sql: string; onChange: (sql: string) => void };

export function SqlPanel({ sql, onChange }: Props) {
  const [draft, setDraft] = useState(sql);
  const run = useMutation({ mutationFn: (s: string) => api.sql({ sql: s, limit: 500 }) });
  const error = run.error instanceof ApiError ? run.error.message : run.error?.message;

  const execute = () => { onChange(draft); run.mutate(draft); };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative rounded-md border bg-card/40 font-mono text-xs">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") execute(); }}
          spellCheck={false}
          rows={6}
          className="w-full resize-y bg-transparent p-3 leading-relaxed outline-none"
          placeholder="SELECT service, count() AS c FROM clickpower.logs WHERE timestamp > now() - INTERVAL 1 HOUR GROUP BY service ORDER BY c DESC"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">⌘⏎</span>
          <Button size="xs" onClick={execute} disabled={run.isPending}><PlayIcon /> Run</Button>
        </div>
      </div>
      {error && <div className="fade-up rounded-md border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">{error}</div>}
      <StatsBar stats={run.data?.stats} shown={run.data?.rows.length ?? 0} />
      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-card/30 font-mono text-xs">
        {run.data && (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-background/95 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
              <tr>{run.data.columns.map((c) => <th key={c} className="border-b px-3 py-1.5 text-left font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {run.data.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-accent/40">
                  {run.data.columns.map((c) => <td key={c} className="max-w-md truncate px-3 py-1 tabular">{fmt(r[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!run.data && !run.isPending && (
          <div className="flex h-full items-center justify-center text-muted-foreground">run a query · read-only user · 500 row cap</div>
        )}
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}
