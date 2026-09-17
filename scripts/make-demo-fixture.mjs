/**
 * Build the Parquet fixture the chDB demo engine serves.
 *
 * Generates logs with the same generator the seeder uses, then lets chDB write the
 * Parquet so no ClickHouse server is needed. `attributes` is stored as a JSON string
 * and cast to the JSON type at load time, which keeps the fixture portable.
 *
 * Usage:
 *   node scripts/make-demo-fixture.mjs [--minutes=1440] [--rate=6] [--out=demo/logs.parquet]
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateRange } from "./lib/generate.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const MINUTES = Number(args.minutes ?? 1440);
const RATE = Number(args.rate ?? 6);
const OUT = path.resolve(args.out ?? "demo/logs.parquet");

const STRUCTURE =
  "timestamp DateTime64(3), level String, service String, host String, " +
  "message String, trace_id String, span_id String, attributes String";

function quote(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

async function main() {
  let chdb;
  try {
    chdb = await import("chdb");
  } catch {
    console.error("This script needs the optional `chdb` package: pnpm add -D chdb");
    process.exit(1);
  }

  const to = Date.now();
  const rows = generateRange(to - MINUTES * 60_000, to, RATE);
  console.log(`generated ${rows.length.toLocaleString()} rows over ${MINUTES} minutes`);

  // attributes travels as a JSON string; the loader casts it to the JSON type.
  const ndjson = rows
    .map((r) => JSON.stringify({ ...r, attributes: JSON.stringify(r.attributes) }))
    .join("\n");

  const tmp = path.join(os.tmpdir(), `clickpower-fixture-${process.pid}.jsonl`);
  await writeFile(tmp, ndjson);
  await mkdir(path.dirname(OUT), { recursive: true });
  await rm(OUT, { force: true });

  try {
    const sql =
      `INSERT INTO FUNCTION file(${quote(OUT)}, Parquet) ` +
      `SELECT * FROM file(${quote(tmp)}, JSONEachRow, ${quote(STRUCTURE)}) ORDER BY timestamp`;
    chdb.query(sql);
  } finally {
    await rm(tmp, { force: true });
  }

  const mb = statSync(OUT).size / 1048576;
  const check = String(
    chdb.query(
      `SELECT count() AS c, toString(min(timestamp)) AS mn, toString(max(timestamp)) AS mx ` +
        `FROM file(${quote(OUT)}, Parquet)`,
      "JSONEachRow",
    ),
  ).trim();
  console.log(`wrote ${path.relative(process.cwd(), OUT)}  ${mb.toFixed(1)} MB`);
  console.log(check);
}

await main();
