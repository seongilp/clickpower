"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, PlusIcon, MinusIcon, ColumnsIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Props = {
  q: string;
  range: { from: number; to: number };
  columns: string[];
  onFilter: (field: string, value: string, negate?: boolean) => void;
  onToggleColumn: (field: string) => void;
};

export function FieldSidebar({ q, range, columns, onFilter, onToggleColumn }: Props) {
  const fields = useQuery({
    queryKey: ["fields", range],
    queryFn: ({ signal }) => api.fields({ range }, signal),
  });
  const [open, setOpen] = useState<string | null>(null);

  const section = (title: string, list: string[]) => (
    <div>
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      {list.map((f) => (
        <FieldRow
          key={f}
          field={f}
          q={q}
          range={range}
          open={open === f}
          isColumn={columns.includes(f)}
          onOpen={() => setOpen(open === f ? null : f)}
          onFilter={onFilter}
          onToggleColumn={onToggleColumn}
        />
      ))}
    </div>
  );

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar/60">
      {section("Fields", fields.data?.core.filter((f) => f !== "timestamp") ?? [])}
      {section("Attributes", fields.data?.attributes ?? [])}
      {fields.isLoading && <div className="p-3 font-mono text-xs text-muted-foreground">loading…</div>}
    </aside>
  );
}

type RowProps = {
  field: string; q: string; range: Props["range"]; open: boolean; isColumn: boolean;
  onOpen: () => void; onFilter: Props["onFilter"]; onToggleColumn: Props["onToggleColumn"];
};

function FieldRow({ field, q, range, open, isColumn, onOpen, onFilter, onToggleColumn }: RowProps) {
  const values = useQuery({
    queryKey: ["values", field, q, range],
    queryFn: ({ signal }) => api.values({ q, range, field, limit: 8 }, signal),
    enabled: open,
  });
  return (
    <div className={cn("group", open && "bg-accent/40")}>
      <div className="flex items-center gap-1 px-2 py-1 font-mono text-xs">
        <button onClick={onOpen} className="flex flex-1 items-center gap-1 truncate text-left hover:text-primary">
          <ChevronRightIcon className={cn("size-3 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="truncate">{field}</span>
        </button>
        <button
          onClick={() => onToggleColumn(field)}
          title="Toggle column"
          className={cn("rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary", isColumn && "text-primary opacity-100")}
        >
          <ColumnsIcon className="size-3" />
        </button>
      </div>
      {open && (
        <div className="fade-up flex flex-col gap-0.5 px-2 pb-2">
          {values.isLoading && <div className="px-1 font-mono text-[11px] text-muted-foreground">…</div>}
          {values.data?.values.map((v) => {
            const pct = values.data.total ? (v.count / values.data.total) * 100 : 0;
            return (
              <div key={v.value} className="group/v relative flex items-center gap-1 rounded-sm px-1 py-0.5 font-mono text-[11px] hover:bg-accent">
                <div className="absolute inset-y-0 left-0 rounded-sm bg-primary/10" style={{ width: `${pct}%` }} />
                <span className="relative flex-1 truncate" title={v.value}>{v.value}</span>
                <span className="relative text-muted-foreground tabular">{pct.toFixed(0)}%</span>
                <span className="relative hidden gap-0.5 group-hover/v:flex">
                  <button onClick={() => onFilter(field, v.value)} className="rounded-sm bg-primary/20 p-0.5 text-primary" title="Filter for"><PlusIcon className="size-3" /></button>
                  <button onClick={() => onFilter(field, v.value, true)} className="rounded-sm bg-destructive/20 p-0.5 text-destructive" title="Filter out"><MinusIcon className="size-3" /></button>
                </span>
              </div>
            );
          })}
          {values.data && values.data.values.length === 0 && (
            <div className="px-1 font-mono text-[11px] text-muted-foreground">no values</div>
          )}
        </div>
      )}
    </div>
  );
}
