// Fake log generator. Usage: node scripts/seed.mjs [--backfill=MINUTES] [--rate=N]
import { createClient } from "@clickhouse/client";
import { faker } from "@faker-js/faker";

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

const SERVICES = [
  { name: "api-gateway", hosts: ["gw-1", "gw-2"], weight: 4 },
  { name: "auth", hosts: ["auth-1"], weight: 2 },
  { name: "orders", hosts: ["orders-1", "orders-2", "orders-3"], weight: 3 },
  { name: "payments", hosts: ["pay-1"], weight: 1 },
  { name: "search", hosts: ["search-1", "search-2"], weight: 2 },
];
const LEVELS = [
  ["debug", 20], ["info", 60], ["warn", 12], ["error", 7], ["fatal", 1],
];
const ROUTES = ["/api/users", "/api/orders", "/api/cart", "/api/search", "/api/login", "/health"];
const ERRORS = [
  "connection timeout to upstream",
  "database deadlock detected",
  "invalid token signature",
  "payment provider returned 502",
  "context deadline exceeded",
  "null pointer dereference in handler",
];

function pickWeighted(items, weightOf) {
  const total = items.reduce((s, i) => s + weightOf(i), 0);
  let r = Math.random() * total;
  for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

function makeLog(ts) {
  const svc = pickWeighted(SERVICES, (s) => s.weight);
  const [level] = pickWeighted(LEVELS, (l) => l[1]);
  const route = faker.helpers.arrayElement(ROUTES);
  const status = level === "error" || level === "fatal"
    ? faker.helpers.arrayElement([500, 502, 503, 504])
    : level === "warn" ? faker.helpers.arrayElement([400, 401, 404, 429]) : 200;
  const duration = Math.round(faker.number.float({ min: 2, max: level === "warn" ? 1800 : 400 }));
  const message = level === "error" || level === "fatal"
    ? `${faker.helpers.arrayElement(ERRORS)} (route=${route})`
    : level === "warn"
      ? `slow request ${route} took ${duration}ms`
      : `${faker.internet.httpMethod()} ${route} ${status} ${duration}ms`;
  return {
    timestamp: ts.toISOString().replace("T", " ").replace("Z", ""),
    level,
    service: svc.name,
    host: faker.helpers.arrayElement(svc.hosts),
    message,
    trace_id: faker.string.hexadecimal({ length: 32, casing: "lower", prefix: "" }),
    span_id: faker.string.hexadecimal({ length: 16, casing: "lower", prefix: "" }),
    attributes: {
      http: { method: faker.internet.httpMethod(), route, status, duration_ms: duration },
      user_id: faker.number.int({ min: 1, max: 5000 }),
      region: faker.helpers.arrayElement(["us-east-1", "eu-west-1", "ap-northeast-2"]),
      client_ip: faker.internet.ipv4(),
      version: faker.helpers.arrayElement(["1.4.2", "1.4.3", "1.5.0"]),
    },
  };
}

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
