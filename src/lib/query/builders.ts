import { LOGS_TABLE } from "@/lib/ch/config";
import { resolveField } from "@/lib/dsl/fields";
import { buildWhere, type Where } from "./where";
import type { FieldValuesRequest, HistogramRequest, LogsRequest } from "./types";

const LOG_COLUMNS = "timestamp, level, service, host, message, trace_id, span_id, attributes";

export function buildLogsSql(req: LogsRequest): Where {
  const w = buildWhere(req.q, req.range);
  const params = { ...w.params, limit: req.limit };
  const dir = req.order === "asc" ? "ASC" : "DESC";
  const cursorSql = req.cursor === undefined
    ? ""
    : ` AND timestamp ${req.order === "asc" ? ">" : "<"} fromUnixTimestamp64Milli({cursor:Int64})`;
  if (req.cursor !== undefined) Object.assign(params, { cursor: req.cursor });
  const sql =
    `SELECT ${LOG_COLUMNS} FROM ${LOGS_TABLE} WHERE ${w.sql}${cursorSql} ` +
    `ORDER BY timestamp ${dir} LIMIT {limit:UInt32}`;
  return { sql, params };
}

/** Pick a bucket size (seconds) that yields roughly `buckets` bars. */
export function pickStepSeconds(rangeMs: number, buckets: number): number {
  const NICE = [1, 5, 10, 30, 60, 300, 600, 1800, 3600, 10800, 21600, 43200, 86400];
  const ideal = rangeMs / 1000 / buckets;
  return NICE.find((n) => n >= ideal) ?? NICE[NICE.length - 1];
}

export function buildHistogramSql(req: HistogramRequest): Where & { stepSeconds: number } {
  const w = buildWhere(req.q, req.range);
  const stepSeconds = pickStepSeconds(req.range.to - req.range.from, req.buckets);
  const sql =
    `SELECT toUnixTimestamp64Milli(toDateTime64(toStartOfInterval(timestamp, toIntervalSecond({step:UInt32})), 3)) AS t, ` +
    `level, count() AS c FROM ${LOGS_TABLE} WHERE ${w.sql} GROUP BY t, level ORDER BY t`;
  return { sql, params: { ...w.params, step: stepSeconds }, stepSeconds };
}

export function buildFieldValuesSql(req: FieldValuesRequest): Where {
  const w = buildWhere(req.q, req.range);
  const { expr, core } = resolveField(req.field);
  const valueExpr = core ? expr : `toString(${expr})`;
  const sql =
    `SELECT ${valueExpr} AS v, count() AS c FROM ${LOGS_TABLE} WHERE ${w.sql} AND v != '' ` +
    `GROUP BY v ORDER BY c DESC LIMIT {limit:UInt32}`;
  return { sql, params: { ...w.params, limit: req.limit } };
}

/** Distinct attribute paths seen in the range (sampled to keep it cheap). */
export function buildFieldListSql(range: { from: number; to: number }): Where {
  const w = buildWhere("", range);
  const sql =
    `SELECT arrayJoin(distinctJSONPaths(attributes)) AS path FROM ` +
    `(SELECT attributes FROM ${LOGS_TABLE} WHERE ${w.sql} ORDER BY timestamp DESC LIMIT 5000) ORDER BY path`;
  return { sql, params: w.params };
}
