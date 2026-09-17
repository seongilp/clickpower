import { reader } from "./client";
import { statsFrom, type Driver } from "./driver";

/** Production engine: a ClickHouse server over HTTP, queried as the read-only user. */
export const httpDriver: Driver = {
  engine: "clickhouse",
  enforcesReadOnly: true,
  async select<T>(sql: string, params: Record<string, unknown>) {
    const started = performance.now();
    const rs = await reader().query({ query: sql, query_params: params, format: "JSON" });
    const body = (await rs.json()) as {
      data: T[];
      statistics?: { elapsed?: number; rows_read?: number; bytes_read?: number };
    };
    return {
      rows: body.data ?? [],
      stats: statsFrom(body.statistics, Math.round(performance.now() - started)),
    };
  },
};
