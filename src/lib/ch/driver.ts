import type { QueryStats } from "@/lib/query/types";

/**
 * The app talks to one of two ClickHouse engines through this interface:
 * a ClickHouse server over HTTP, or chDB embedded in this process (demo mode).
 * Both speak the same SQL and the same `{pN:Type}` parameter binding, so nothing
 * above this layer has to know which one is live.
 */
export type Driver = {
  readonly engine: Engine;
  /** True when the engine enforces read-only access itself, via a restricted DB user. */
  readonly enforcesReadOnly: boolean;
  select<T>(sql: string, params: Record<string, unknown>): Promise<{ rows: T[]; stats: QueryStats }>;
};

export type Engine = "clickhouse" | "chdb";

export function resolveEngine(env: NodeJS.ProcessEnv = process.env): Engine {
  return env.CLICKPOWER_ENGINE === "chdb" ? "chdb" : "clickhouse";
}

/** Parse the `statistics` block ClickHouse emits with `FORMAT JSON`. */
export function statsFrom(
  statistics: { elapsed?: number; rows_read?: number; bytes_read?: number } | undefined,
  fallbackElapsedMs: number,
): QueryStats {
  return {
    elapsedMs: statistics?.elapsed !== undefined ? Math.round(statistics.elapsed * 1000) : fallbackElapsedMs,
    rowsRead: statistics?.rows_read ?? 0,
    bytesRead: statistics?.bytes_read ?? 0,
  };
}
