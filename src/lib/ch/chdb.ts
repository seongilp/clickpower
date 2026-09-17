import path from "node:path";
import { LOGS_TABLE, LOGS_DB } from "./config";
import { statsFrom, type Driver } from "./driver";

/**
 * Demo engine: ClickHouse embedded in this process via chDB, serving a Parquet
 * fixture that ships with the deployment.
 *
 * The fixture is loaded into a real MergeTree inside the session rather than
 * queried through `file()`. That buys three things: the skip indexes work, JSON
 * paths become subcolumns instead of re-parsed text (~20x on field pivots), and
 * afterwards nothing in the session needs filesystem access, so user SQL can be
 * denied the `file`/`url`/`s3` table functions outright.
 */

type ChdbSession = {
  query(sql: string, format?: string): unknown;
  queryBind(sql: string, params: Record<string, unknown>, format?: string): unknown;
  close(): void;
};

type ChdbModule = { Session: new (dir: string) => ChdbSession };

const SESSION_DIR = process.env.CHDB_SESSION_DIR ?? path.join("/tmp", "clickpower-chdb");
const FIXTURE = path.resolve(process.env.DEMO_PARQUET ?? "demo/logs.parquet");

let ready: Promise<ChdbSession> | null = null;

async function loadModule(): Promise<ChdbModule> {
  try {
    return (await import("chdb")) as unknown as ChdbModule;
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error(
      "CLICKPOWER_ENGINE=chdb could not load the optional `chdb` package. Install it, or " +
        `unset CLICKPOWER_ENGINE to use a ClickHouse server over HTTP. Cause: ${cause}`,
    );
  }
}

/**
 * Timestamps in the fixture are frozen at build time, so the whole table is shifted
 * forward to end at "now". The offset is fixed for the life of the session, which
 * means a long-lived instance serves data that ages — acceptable for a demo, and it
 * keeps the shift out of the query path where it would defeat the primary key.
 */
function buildSession(mod: ChdbModule): ChdbSession {
  const session = new mod.Session(SESSION_DIR);
  const one = (sql: string): Record<string, unknown> => {
    const raw = String(session.query(sql, "JSONEachRow")).trim();
    return raw ? (JSON.parse(raw.split("\n")[0]) as Record<string, unknown>) : {};
  };

  const { v: maxTs } = one(
    `SELECT toString(max(timestamp)) AS v FROM file(${quote(FIXTURE)}, Parquet)`,
  ) as { v?: string };
  if (!maxTs) throw new Error(`Demo fixture has no rows: ${FIXTURE}`);
  const shiftSeconds = Math.floor((Date.now() - Date.parse(`${maxTs}Z`)) / 1000);

  session.query(`CREATE DATABASE IF NOT EXISTS ${LOGS_DB}`);
  session.query(`DROP TABLE IF EXISTS ${LOGS_TABLE}`);
  session.query(`
    CREATE TABLE ${LOGS_TABLE}
    (
      timestamp   DateTime64(3, 'UTC'),
      level       LowCardinality(String),
      service     LowCardinality(String),
      host        LowCardinality(String),
      message     String,
      trace_id    String,
      span_id     String,
      attributes  JSON,
      INDEX idx_msg   message  TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4,
      INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4
    )
    ENGINE = MergeTree
    PARTITION BY toDate(timestamp)
    ORDER BY (service, level, timestamp)`);
  session.query(`
    INSERT INTO ${LOGS_TABLE}
    SELECT timestamp + toIntervalSecond(${shiftSeconds}), level, service, host, message,
           trace_id, span_id, CAST(attributes, 'JSON')
    FROM file(${quote(FIXTURE)}, Parquet)`);

  return session;
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** One session per process, rebuilt on cold start. Concurrent callers share the same promise. */
function getSession(): Promise<ChdbSession> {
  if (!ready) {
    ready = loadModule()
      .then(buildSession)
      .catch((e) => {
        ready = null; // let the next request retry instead of caching the failure
        throw e;
      });
  }
  return ready;
}

export const chdbDriver: Driver = {
  engine: "chdb",
  enforcesReadOnly: false,
  async select<T>(sql: string, params: Record<string, unknown>) {
    const session = await getSession();
    const started = performance.now();
    const raw = String(session.queryBind(sql, params, "JSON"));
    const fallback = Math.round(performance.now() - started);
    if (!raw.trim()) return { rows: [] as T[], stats: statsFrom(undefined, fallback) };
    const parsed = JSON.parse(raw) as {
      data: T[];
      statistics?: { elapsed?: number; rows_read?: number; bytes_read?: number };
    };
    return { rows: parsed.data ?? [], stats: statsFrom(parsed.statistics, fallback) };
  },
};
