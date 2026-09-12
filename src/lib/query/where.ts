import { parse } from "@/lib/dsl/parser";
import { compile } from "@/lib/dsl/compile";
import type { TimeRange } from "./types";

export type Where = { sql: string; params: Record<string, string | number> };

/** Time range + optional DSL filter, all param-bound. */
export function buildWhere(q: string, range: TimeRange): Where {
  const parts = [
    "timestamp >= fromUnixTimestamp64Milli({from:Int64})",
    "timestamp < fromUnixTimestamp64Milli({to:Int64})",
  ];
  const params: Record<string, string | number> = { from: range.from, to: range.to };
  const ast = parse(q);
  if (ast) {
    const c = compile(ast);
    parts.push(c.sql);
    Object.assign(params, c.params);
  }
  return { sql: parts.join(" AND "), params };
}
