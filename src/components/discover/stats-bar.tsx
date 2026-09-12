import type { QueryStats } from "@/lib/query/types";

export function StatsBar({ stats, shown, sql }: { stats?: QueryStats; shown: number; sql?: string }) {
  if (!stats) return <div className="h-5" />;
  const mb = stats.bytesRead / 1_048_576;
  return (
    <div className="flex h-5 items-center gap-3 px-1 font-mono text-[11px] text-muted-foreground">
      <span><b className="font-medium text-foreground tabular">{shown.toLocaleString()}</b> shown</span>
      <span className="opacity-40">·</span>
      <span><b className="font-medium text-primary tabular">{stats.elapsedMs}</b> ms</span>
      <span className="opacity-40">·</span>
      <span><b className="font-medium text-foreground tabular">{stats.rowsRead.toLocaleString()}</b> rows scanned</span>
      <span className="opacity-40">·</span>
      <span><b className="font-medium text-foreground tabular">{mb.toFixed(1)}</b> MB</span>
      {sql && (
        <details className="ml-auto">
          <summary className="cursor-pointer select-none hover:text-foreground">sql</summary>
          <pre className="absolute right-4 z-20 mt-1 max-w-2xl rounded-md border bg-popover p-3 text-[11px] whitespace-pre-wrap shadow-xl">{sql}</pre>
        </details>
      )}
    </div>
  );
}
