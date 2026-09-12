/** Time range expressions kept in the URL: `now`, `now-15m`, epoch ms, or ISO string. */
export type RangeExpr = string;

const REL = /^now(?:-(\d+)([smhd]))?$/;
const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function resolveExpr(expr: RangeExpr, now = Date.now()): number {
  const m = REL.exec(expr.trim());
  if (m) return m[1] ? now - Number(m[1]) * UNIT_MS[m[2]] : now;
  if (/^\d+$/.test(expr)) return Number(expr);
  const t = Date.parse(expr);
  if (Number.isNaN(t)) throw new Error(`Invalid time expression: ${expr}`);
  return t;
}

export function resolveRange(from: RangeExpr, to: RangeExpr, now = Date.now()) {
  return { from: resolveExpr(from, now), to: resolveExpr(to, now) };
}

export const QUICK_RANGES: { label: string; from: RangeExpr }[] = [
  { label: "5m", from: "now-5m" },
  { label: "15m", from: "now-15m" },
  { label: "1h", from: "now-1h" },
  { label: "3h", from: "now-3h" },
  { label: "12h", from: "now-12h" },
  { label: "24h", from: "now-24h" },
  { label: "7d", from: "now-7d" },
];

export function describeRange(from: RangeExpr, to: RangeExpr): string {
  const q = QUICK_RANGES.find((r) => r.from === from);
  if (q && to === "now") return `Last ${q.label}`;
  return `${fmtExpr(from)} → ${fmtExpr(to)}`;
}

function fmtExpr(e: RangeExpr): string {
  if (REL.test(e)) return e;
  return formatTs(resolveExpr(e), { seconds: false });
}

export function formatTs(ms: number | string, opts: { seconds?: boolean; ms?: boolean } = {}): string {
  const d = typeof ms === "number" ? new Date(ms) : new Date(ms.replace(" ", "T") + "Z");
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  let s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (opts.seconds !== false) s += `:${pad(d.getSeconds())}`;
  if (opts.ms) s += `.${pad(d.getMilliseconds(), 3)}`;
  return s;
}

/** ClickHouse returns "YYYY-MM-DD HH:MM:SS.mmm" in UTC; convert to epoch ms. */
export function chTsToMs(ts: string): number {
  return Date.parse(ts.replace(" ", "T") + "Z");
}
