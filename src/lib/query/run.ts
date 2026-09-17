import { chdbDriver } from "@/lib/ch/chdb";
import { httpDriver } from "@/lib/ch/http";
import { resolveEngine, type Driver } from "@/lib/ch/driver";
import type { QueryStats } from "./types";

export type RunResult<T> = { rows: T[]; stats: QueryStats };

/** The engine this process talks to, chosen once from the environment. */
export function driver(): Driver {
  return resolveEngine() === "chdb" ? chdbDriver : httpDriver;
}

/** Execute a SELECT with bound params against the read-only engine. */
export async function runSelect<T>(sql: string, params: Record<string, unknown>): Promise<RunResult<T>> {
  return driver().select<T>(sql, params);
}
