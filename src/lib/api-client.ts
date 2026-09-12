import type { ApiErr, ApiOk } from "@/lib/api/respond";
import type { LogRow, QueryStats, TimeRange } from "@/lib/query/types";

export class ApiError extends Error {
  constructor(message: string, public readonly position?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!json.ok) throw new ApiError(json.error.message, json.error.position);
  return json.data;
}

export type LogsResponse = { rows: LogRow[]; stats: QueryStats; sql: string };
export type HistogramResponse = {
  buckets: { t: number; level: string; c: number }[];
  stepSeconds: number;
  stats: QueryStats;
};
export type FieldsResponse = { core: string[]; attributes: string[] };
export type ValuesResponse = { values: { value: string; count: number }[]; total: number; stats: QueryStats };
export type SqlResponse = { rows: Record<string, unknown>[]; columns: string[]; stats: QueryStats };

export const api = {
  logs: (b: { q: string; range: TimeRange; limit?: number; cursor?: number; order?: "asc" | "desc" }, s?: AbortSignal) =>
    post<LogsResponse>("/api/query/logs", b, s),
  histogram: (b: { q: string; range: TimeRange; buckets?: number }, s?: AbortSignal) =>
    post<HistogramResponse>("/api/query/histogram", b, s),
  fields: (b: { range: TimeRange }, s?: AbortSignal) => post<FieldsResponse>("/api/query/fields", b, s),
  values: (b: { q: string; range: TimeRange; field: string; limit?: number }, s?: AbortSignal) =>
    post<ValuesResponse>("/api/query/values", b, s),
  sql: (b: { sql: string; limit?: number }, s?: AbortSignal) => post<SqlResponse>("/api/query/sql", b, s),
};
