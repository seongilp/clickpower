// Fake log generator. Usage: node scripts/seed.mjs [--backfill=MINUTES] [--rate=N]
import { createClient } from "@clickhouse/client";
import { makeLog } from "./lib/generate.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }),
);
const RATE = Number(args.rate ?? process.env.SEED_RATE ?? 50);
const BACKFILL_MIN = Number(args.backfill ?? process.env.SEED_BACKFILL_MIN ?? 60);

const client = createClient({
  url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
  username: process.env.CLICKHOUSE_WRITER_USER ?? "default",
  password: process.env.CLICKHOUSE_WRITER_PASSWORD ?? "",
  clickhouse_settings: { async_insert: 1, wait_for_async_insert: 0 },
});

async function insert(rows) {
  await client.insert({ table: "clickpower.logs", values: rows, format: "JSONEachRow" });
}

async function backfill() {
  const now = Date.now();
  const start = now - BACKFILL_MIN * 60_000;
  const perSec = RATE;
  let batch = [];
  let count = 0;
  for (let t = start; t < now; t += 1000) {
    for (let i = 0; i < perSec; i++) {
      batch.push(makeLog(new Date(t + Math.random() * 1000)));
    }
    if (batch.length >= 10_000) { await insert(batch); count += batch.length; batch = []; }
  }
  if (batch.length) { await insert(batch); count += batch.length; }
  console.log(`backfilled ${count} rows over ${BACKFILL_MIN} minutes`);
}

async function live() {
  console.log(`streaming ~${RATE} logs/sec (ctrl-c to stop)`);
  setInterval(async () => {
    const rows = Array.from({ length: RATE }, () => makeLog(new Date()));
    try { await insert(rows); } catch (e) { console.error("insert failed:", e.message); }
  }, 1000);
}

await backfill();
if (!args.once) await live();
