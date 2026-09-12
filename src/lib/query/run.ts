import { reader } from "@/lib/ch/client";
import type { QueryStats } from "./types";

export type RunResult<T> = { rows: T[]; stats: QueryStats };

/** Execute a SELECT with bound params against the read-only client. */
export async function runSelect<T>(sql: string, params: Record<string, unknown>): Promise<RunResult<T>> {
  const started = performance.now();
  const rs = await reader().query({ query: sql, query_params: params, format: "JSONEachRow" });
  const rows = await rs.json<T>();
  const summary = parseSummary(rs.response_headers["x-clickhouse-summary"]);
  return {
    rows,
    stats: {
      elapsedMs: Math.round(performance.now() - started),
      rowsRead: summary.read_rows,
      bytesRead: summary.read_bytes,
    },
  };
}

function parseSummary(header: string | string[] | undefined): { read_rows: number; read_bytes: number } {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return { read_rows: 0, read_bytes: 0 };
  try {
    const j = JSON.parse(raw) as Record<string, string>;
    return { read_rows: Number(j.read_rows ?? 0), read_bytes: Number(j.read_bytes ?? 0) };
  } catch {
    return { read_rows: 0, read_bytes: 0 };
  }
}
