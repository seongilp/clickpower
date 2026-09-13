import { writer } from "@/lib/ch/client";
import { LOGS_TABLE } from "@/lib/ch/config";
import { fail, ok } from "@/lib/api/respond";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore plain ESM helper shared with scripts/seed.mjs
import { generateRange } from "../../../../../scripts/lib/generate.mjs";

/**
 * Demo-only: fills the last N minutes with fake logs. Enabled only when DEMO_SEED_SECRET is set;
 * called by Vercel Cron (Authorization: Bearer <CRON_SECRET>) or manually with ?secret=.
 */
export async function GET(req: Request) {
  const secret = process.env.DEMO_SEED_SECRET;
  if (!secret) return fail("demo seeding disabled", 404);
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const given = url.searchParams.get("secret") ?? (auth?.startsWith("Bearer ") ? auth.slice(7) : null);
  if (given !== secret && given !== process.env.CRON_SECRET) return fail("unauthorized", 401);

  const minutes = Math.min(Number(url.searchParams.get("minutes") ?? 10), 180);
  const perSec = Math.min(Number(url.searchParams.get("rate") ?? 5), 50);
  const to = Date.now();
  const rows = generateRange(to - minutes * 60_000, to, perSec) as unknown[];
  await writer().insert({ table: LOGS_TABLE, values: rows, format: "JSONEachRow" });
  return ok({ inserted: rows.length, minutes, perSec });
}
