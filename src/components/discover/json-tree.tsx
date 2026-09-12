"use client";

import { PlusIcon, MinusIcon, ColumnsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: unknown;
  path?: string;
  onFilter?: (field: string, value: string, negate?: boolean) => void;
  onToggleColumn?: (field: string) => void;
};

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export function JsonTree({ value, path = "", onFilter, onToggleColumn }: Props) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className={cn("flex flex-col", path && "ml-3 border-l border-border/60 pl-2")}>
        {entries.map(([k, v]) => {
          const p = path ? `${path}.${k}` : k;
          const leaf = v === null || typeof v !== "object";
          return (
            <div key={k} className="group/row">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-muted-foreground">{k}</span>
                {leaf && <Leaf v={v} />}
                {leaf && (onFilter || onToggleColumn) && (
                  <span className="ml-auto hidden gap-0.5 group-hover/row:flex">
                    {onFilter && <IconBtn title="Filter for" onClick={() => onFilter(p, String(v))}><PlusIcon className="size-3" /></IconBtn>}
                    {onFilter && <IconBtn title="Filter out" danger onClick={() => onFilter(p, String(v), true)}><MinusIcon className="size-3" /></IconBtn>}
                    {onToggleColumn && <IconBtn title="Toggle column" onClick={() => onToggleColumn(p)}><ColumnsIcon className="size-3" /></IconBtn>}
                  </span>
                )}
              </div>
              {!leaf && <JsonTree value={v} path={p} onFilter={onFilter} onToggleColumn={onToggleColumn} />}
            </div>
          );
        })}
      </div>
    );
  }
  if (Array.isArray(value)) return <span className="text-foreground">{JSON.stringify(value)}</span>;
  return <Leaf v={value} />;
}

function Leaf({ v }: { v: unknown }) {
  const cls = typeof v === "number" ? "text-primary" : typeof v === "boolean" ? "text-chart-5" : v === null ? "text-muted-foreground italic" : "text-foreground";
  return <span className={cn("truncate", cls)}>{v === null ? "null" : String(v)}</span>;
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={cn("rounded-sm p-0.5", danger ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary")}>
      {children}
    </button>
  );
}
