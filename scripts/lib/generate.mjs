// Shared fake-log generator (used by scripts/seed.mjs and /api/demo/seed).
import { faker } from "@faker-js/faker";

const SERVICES = [
  { name: "api-gateway", hosts: ["gw-1", "gw-2"], weight: 4 },
  { name: "auth", hosts: ["auth-1"], weight: 2 },
  { name: "orders", hosts: ["orders-1", "orders-2", "orders-3"], weight: 3 },
  { name: "payments", hosts: ["pay-1"], weight: 1 },
  { name: "search", hosts: ["search-1", "search-2"], weight: 2 },
];
const LEVELS = [["debug", 20], ["info", 60], ["warn", 12], ["error", 7], ["fatal", 1]];
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

export function toChTimestamp(date) {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

export function makeLog(ts) {
  const svc = pickWeighted(SERVICES, (s) => s.weight);
  const [level] = pickWeighted(LEVELS, (l) => l[1]);
  const route = faker.helpers.arrayElement(ROUTES);
  const isErr = level === "error" || level === "fatal";
  const status = isErr
    ? faker.helpers.arrayElement([500, 502, 503, 504])
    : level === "warn" ? faker.helpers.arrayElement([400, 401, 404, 429]) : 200;
  const duration = Math.round(faker.number.float({ min: 2, max: level === "warn" ? 1800 : 400 }));
  const message = isErr
    ? `${faker.helpers.arrayElement(ERRORS)} (route=${route})`
    : level === "warn"
      ? `slow request ${route} took ${duration}ms`
      : `${faker.internet.httpMethod()} ${route} ${status} ${duration}ms`;
  return {
    timestamp: toChTimestamp(ts),
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

/** Generate `perSec` logs per second spread across [from, to). */
export function generateRange(from, to, perSec) {
  const out = [];
  for (let t = from; t < to; t += 1000) {
    for (let i = 0; i < perSec; i++) out.push(makeLog(new Date(t + Math.random() * 1000)));
  }
  return out;
}
