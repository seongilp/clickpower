"use client";

import { XIcon, CopyIcon, LinkIcon, RowsIcon } from "lucide-react";
import type { LogRow } from "@/lib/query/types";
import { formatTs, chTsToMs } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "./level-badge";
import { JsonTree } from "./json-tree";

type Props = {
  row: LogRow | null;
  onClose: () => void;
  onFilter: (field: string, value: string, negate?: boolean) => void;
  onToggleColumn: (field: string) => void;
  onTrace: (traceId: string) => void;
  onContext: (row: LogRow) => void;
};

export function LogDetail({ row, onClose, onFilter, onToggleColumn, onTrace, onContext }: Props) {
  if (!row) return null;
  const core = { level: row.level, service: row.service, host: row.host, trace_id: row.trace_id, span_id: row.span_id };
  return (
    <aside className="fade-up flex h-full w-[28rem] shrink-0 flex-col border-l bg-card/70 font-mono text-xs backdrop-blur">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <LevelBadge level={row.level} />
        <span className="text-muted-foreground tabular">{formatTs(chTsToMs(row.timestamp), { ms: true })}</span>
        <button onClick={onClose} className="ml-auto rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><XIcon className="size-4" /></button>
      </header>
      <div className="flex gap-1 border-b px-3 py-2">
        <Button size="xs" variant="outline" onClick={() => navigator.clipboard.writeText(JSON.stringify(row, null, 2))}><CopyIcon /> JSON</Button>
        {row.trace_id && <Button size="xs" variant="outline" onClick={() => onTrace(row.trace_id)}><LinkIcon /> trace</Button>}
        <Button size="xs" variant="outline" onClick={() => onContext(row)}><RowsIcon /> context</Button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <p className="mb-3 rounded-md border bg-background/60 p-2 leading-relaxed break-words whitespace-pre-wrap text-foreground">{row.message}</p>
        <Section title="core"><JsonTree value={core} onFilter={onFilter} onToggleColumn={onToggleColumn} /></Section>
        <Section title="attributes"><JsonTree value={row.attributes} onFilter={onFilter} onToggleColumn={onToggleColumn} /></Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
