"use client";

import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { chTsToMs } from "@/lib/time";
import { parse } from "@/lib/dsl/parser";
import type { LogRow } from "@/lib/query/types";
import { AppNav } from "@/components/shell/app-nav";
import { useDiscoverState } from "./use-discover-state";
import { QueryBar } from "./query-bar";
import { TimePicker } from "./time-picker";
import { Histogram } from "./histogram";
import { FieldSidebar } from "./field-sidebar";
import { LogTable } from "./log-table";
import { LogDetail } from "./log-detail";
import { StatsBar } from "./stats-bar";
import { SqlPanel } from "./sql-panel";
import { ModeToggle } from "./mode-toggle";

const PAGE = 200;

export function DiscoverView() {
  const s = useDiscoverState();
  const [selected, setSelected] = useState<number | null>(null);

  const logs = useInfiniteQuery({
    queryKey: ["logs", s.q, s.range],
    queryFn: ({ pageParam, signal }) => api.logs({ q: s.q, range: s.range, limit: PAGE, cursor: pageParam }, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.rows.length < PAGE ? undefined : chTsToMs(last.rows[last.rows.length - 1].timestamp)),
    placeholderData: (prev) => prev,
  });

  const hist = useQuery({
    queryKey: ["histogram", s.q, s.range],
    queryFn: ({ signal }) => api.histogram({ q: s.q, range: s.range, buckets: 120 }, signal),
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => logs.data?.pages.flatMap((p) => p.rows) ?? [], [logs.data]);
  const first = logs.data?.pages[0];
  const error = logs.error instanceof ApiError ? { message: logs.error.message, position: logs.error.position } : logs.error ? { message: logs.error.message } : null;
  const highlight = useMemo(() => extractTextTerms(s.q), [s.q]);
  const selectedRow: LogRow | null = selected !== null ? rows[selected] ?? null : null;

  const loadMore = useCallback(() => { if (logs.hasNextPage && !logs.isFetchingNextPage) void logs.fetchNextPage(); }, [logs]);
  const submit = useCallback((q: string) => { setSelected(null); void s.setQuery(q); }, [s]);

  const onContext = useCallback((row: LogRow) => {
    const t = chTsToMs(row.timestamp);
    void s.setRange(String(t - 60_000), String(t + 60_000));
    void s.setQuery(`service:${row.service} host:${row.host}`);
    setSelected(null);
  }, [s]);

  return (
    <div className="flex h-full">
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <ModeToggle mode={s.mode} onChange={(m) => { if (m === "sql" && !s.sql && first?.sql) void s.setSql(first.sql); void s.setMode(m); }} />
          {s.mode === "dsl" ? (
            <>
              <div className="flex-1"><QueryBar value={s.q} onSubmit={submit} error={error} loading={logs.isFetching} /></div>
              <TimePicker from={s.from} to={s.to} onChange={(f, t) => { setSelected(null); void s.setRange(f, t); }} />
            </>
          ) : (
            <div className="flex-1 font-mono text-xs text-muted-foreground">raw ClickHouse SQL · read-only</div>
          )}
        </header>
        <div className="flex min-h-0 flex-1">
          <FieldSidebar q={s.q} range={s.range} columns={s.cols} onFilter={s.applyFilter} onToggleColumn={s.toggleColumn} />
          {s.mode === "sql" ? (
            <main className="flex min-w-0 flex-1 flex-col p-3"><SqlPanel sql={s.sql} onChange={(v) => void s.setSql(v)} /></main>
          ) : (
          <main className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <Histogram data={hist.data} range={s.range} onSelectRange={(f, t) => void s.setRange(String(f), String(t))} />
            <StatsBar stats={first?.stats} shown={rows.length} sql={first?.sql} />
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-card/30">
              <LogTable
                rows={rows}
                columns={s.cols}
                highlight={highlight}
                selectedIndex={selected}
                onSelect={setSelected}
                onLoadMore={loadMore}
                hasMore={!!logs.hasNextPage}
                loadingMore={logs.isFetchingNextPage || (logs.isLoading && rows.length === 0)}
              />
            </div>
          </main>
          )}
          <LogDetail
            row={selectedRow}
            onClose={() => setSelected(null)}
            onFilter={s.applyFilter}
            onToggleColumn={s.toggleColumn}
            onTrace={(id) => { setSelected(null); void s.setQuery(`trace_id:${id}`); }}
            onContext={onContext}
          />
        </div>
      </div>
    </div>
  );
}

/** Free-text terms in the query, used for highlighting matches in the table. */
function extractTextTerms(q: string): string[] {
  try {
    const ast = parse(q);
    const out: string[] = [];
    const walk = (n: NonNullable<typeof ast>) => {
      if (n.type === "text" && !n.negated) out.push(n.value.replace(/\*/g, ""));
      if (n.type === "term" && n.field === "message" && !n.negated) out.push(n.value.replace(/\*/g, ""));
      if (n.type === "and" || n.type === "or") n.children.forEach(walk);
    };
    if (ast) walk(ast);
    return out.filter(Boolean);
  } catch {
    return [];
  }
}
