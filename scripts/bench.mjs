/**
 * ClickHouse vs DuckDB on the same log data.
 *
 * Exports clickpower.logs to Parquet, loads it into two DuckDB databases
 * (as-exported and sorted by the ClickHouse ORDER BY key), then runs the
 * query shapes the Discover UI issues against all three and reports medians.
 *
 * Usage:
 *   node scripts/bench.mjs                 # full run
 *   node scripts/bench.mjs --runs=11       # more samples per query
 *   node scripts/bench.mjs --reuse         # skip export/load, reuse .bench/
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { mkdir, rm, stat } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const RUNS = Number(args.runs ?? 7);
const REUSE = args.reuse === "true";
const OUT_DIR = path.resolve(args.dir ?? ".bench");
const PARQUET = path.join(OUT_DIR, "logs.parquet");

const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
// Benchmark queries run as the reader the app itself uses (row/time caps included).
const READER = {
  user: process.env.CLICKHOUSE_READER_USER ?? "reader",
  key: process.env.CLICKHOUSE_READER_PASSWORD ?? "",
};
// The Parquet dump is a full-table read, which the reader's max_result_rows forbids.
const WRITER = {
  user: process.env.CLICKHOUSE_WRITER_USER ?? "default",
  key: process.env.CLICKHOUSE_WRITER_PASSWORD ?? "",
};

/** Run a ClickHouse query over HTTP. `format` of "Parquet" returns raw bytes. */
async function chFetch(sql, { format = "JSONCompact", as = READER } = {}) {
  const res = await fetch(`${CH_URL}/?default_format=${format}`, {
    method: "POST",
    headers: { "X-ClickHouse-User": as.user, "X-ClickHouse-Key": as.key },
    body: sql,
  });
  if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** Returns { wallMs, serverMs, rows } for one ClickHouse query. */
async function chQuery(sql) {
  const t = performance.now();
  const res = await chFetch(sql);
  const body = await res.json();
  return {
    wallMs: performance.now() - t,
    serverMs: Number(body.statistics.elapsed) * 1000,
    rows: body.rows,
  };
}

async function exportParquet() {
  const sql = `
    SELECT timestamp, level, service, host, message, trace_id, span_id,
           toString(attributes) AS attributes
    FROM clickpower.logs`;
  const res = await chFetch(sql, { format: "Parquet", as: WRITER });
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(PARQUET, bytes);
  return bytes.length;
}

const DUCK_VARIANTS = {
  unsorted: "",
  sorted: " ORDER BY service, level, timestamp",
};

async function loadDuck(name, orderBy) {
  const file = path.join(OUT_DIR, `${name}.duckdb`);
  if (!REUSE) await rm(file, { force: true });
  const instance = await DuckDBInstance.create(file);
  const con = await instance.connect();
  if (!REUSE) {
    await con.run(`
      CREATE TABLE logs AS
      SELECT timestamp, level, service, host, message, trace_id, span_id,
             attributes::JSON AS attributes
      FROM read_parquet('${PARQUET.replace(/'/g, "''")}')${orderBy}`);
  }
  return con;
}

async function duckQuery(con, sql) {
  const t = performance.now();
  const reader = await con.runAndReadAll(sql);
  const rows = reader.getRows();
  return { wallMs: performance.now() - t, rows: rows.length };
}

/**
 * `now` is pinned to the newest row so every range filter covers real data
 * regardless of when the fixture was seeded.
 */
function buildQueries(now) {
  const ch = (interval) =>
    `timestamp >= toDateTime64('${now}',3) - INTERVAL ${interval} AND timestamp < toDateTime64('${now}',3)`;
  const dk = (interval) =>
    `timestamp >= TIMESTAMP '${now}' - INTERVAL ${interval} AND timestamp < TIMESTAMP '${now}'`;

  return [
    {
      name: "range 1h, ORDER BY ts DESC LIMIT 200",
      ch: `SELECT timestamp, level, service, message FROM clickpower.logs WHERE ${ch("1 HOUR")} ORDER BY timestamp DESC LIMIT 200`,
      duck: `SELECT timestamp, level, service, message FROM logs WHERE ${dk("1 HOUR")} ORDER BY timestamp DESC LIMIT 200`,
    },
    {
      name: "level+service 24h, ORDER BY ts DESC LIMIT 200",
      ch: `SELECT timestamp, level, service, message FROM clickpower.logs WHERE ${ch("24 HOUR")} AND level='error' AND service='api-gateway' ORDER BY timestamp DESC LIMIT 200`,
      duck: `SELECT timestamp, level, service, message FROM logs WHERE ${dk("24 HOUR")} AND level='error' AND service='api-gateway' ORDER BY timestamp DESC LIMIT 200`,
    },
    {
      name: "full-text 'deadlock' 24h, ORDER BY ts DESC LIMIT 200",
      ch: `SELECT timestamp, level, service, message FROM clickpower.logs WHERE ${ch("24 HOUR")} AND hasTokenCaseInsensitive(message,'deadlock') ORDER BY timestamp DESC LIMIT 200`,
      duck: `SELECT timestamp, level, service, message FROM logs WHERE ${dk("24 HOUR")} AND regexp_matches(message, '\\bdeadlock\\b', 'i') ORDER BY timestamp DESC LIMIT 200`,
    },
    {
      name: "histogram 5m x level, 24h",
      ch: `SELECT toStartOfInterval(timestamp, INTERVAL 300 SECOND) t, level, count() c FROM clickpower.logs WHERE ${ch("24 HOUR")} GROUP BY t, level ORDER BY t`,
      duck: `SELECT time_bucket(INTERVAL 300 SECOND, timestamp) t, level, count(*) c FROM logs WHERE ${dk("24 HOUR")} GROUP BY t, level ORDER BY t`,
    },
    {
      name: "JSON http.status>=500 count, 24h",
      ch: `SELECT count() FROM clickpower.logs WHERE ${ch("24 HOUR")} AND toFloat64OrNull(toString(attributes.http.status)) >= 500`,
      duck: `SELECT count(*) FROM logs WHERE ${dk("24 HOUR")} AND TRY_CAST(attributes->>'$.http.status' AS DOUBLE) >= 500`,
    },
    {
      name: "JSON http.route top values, 24h",
      ch: `SELECT toString(attributes.http.route) v, count() c FROM clickpower.logs WHERE ${ch("24 HOUR")} GROUP BY v ORDER BY c DESC LIMIT 10`,
      duck: `SELECT attributes->>'$.http.route' v, count(*) c FROM logs WHERE ${dk("24 HOUR")} GROUP BY v ORDER BY c DESC LIMIT 10`,
    },
    {
      name: "full sort: ORDER BY message LIMIT 200",
      ch: `SELECT timestamp, message FROM clickpower.logs ORDER BY message LIMIT 200`,
      duck: `SELECT timestamp, message FROM logs ORDER BY message LIMIT 200`,
    },
  ];
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** One warm-up call, then RUNS timed samples. */
async function sample(fn) {
  await fn();
  const out = [];
  for (let i = 0; i < RUNS; i++) out.push(await fn());
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const countBody = await (await chFetch("SELECT count() FROM clickpower.logs")).json();
  const rowCount = Number(countBody.data[0][0]);
  if (rowCount === 0) {
    console.error("clickpower.logs is empty. Seed it first: pnpm seed -- --backfill=1440 --rate=10 --once");
    process.exit(1);
  }

  const nowBody = await (await chFetch("SELECT toString(max(timestamp)) FROM clickpower.logs")).json();
  const now = String(nowBody.data[0][0]).slice(0, 19);

  if (!REUSE) {
    process.stderr.write("exporting Parquet… ");
    const bytes = await exportParquet();
    process.stderr.write(`${(bytes / 1e6).toFixed(1)} MB\n`);
  } else {
    await stat(PARQUET); // fail loudly if --reuse has nothing to reuse
  }

  const cons = {};
  for (const [name, orderBy] of Object.entries(DUCK_VARIANTS)) {
    process.stderr.write(`loading DuckDB (${name})… `);
    cons[name] = await loadDuck(name, orderBy);
    process.stderr.write("ok\n");
  }

  console.log(`\nrows: ${rowCount.toLocaleString()}  ·  now: ${now}  ·  median of ${RUNS} runs\n`);
  const header = ["query", "CH wall", "CH server", "Duck unsorted", "Duck sorted", "rows"];
  const rows = [];

  for (const q of buildQueries(now)) {
    const chx = await sample(() => chQuery(q.ch));
    const du = await sample(() => duckQuery(cons.unsorted, q.duck));
    const ds = await sample(() => duckQuery(cons.sorted, q.duck));
    rows.push([
      q.name,
      `${median(chx.map((x) => x.wallMs)).toFixed(1)}ms`,
      `${median(chx.map((x) => x.serverMs)).toFixed(1)}ms`,
      `${median(du.map((x) => x.wallMs)).toFixed(1)}ms`,
      `${median(ds.map((x) => x.wallMs)).toFixed(1)}ms`,
      String(chx[0].rows),
    ]);
  }

  printTable(header, rows);
  console.log(
    "\nClickHouse wall time includes the HTTP round trip; DuckDB runs in-process.\n" +
      "Cold-cache behaviour is not measured — every query is warmed once first.",
  );
}

function printTable(header, rows) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(r));
}

await main();
