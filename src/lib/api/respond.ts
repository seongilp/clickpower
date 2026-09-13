import { ZodError, type ZodType } from "zod";
import { DslError } from "@/lib/dsl/ast";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { message: string; position?: number } };

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies ApiOk<T>, init);
}

export function fail(message: string, status = 400, extra?: { position?: number }): Response {
  return Response.json({ ok: false, error: { message, ...extra } } satisfies ApiErr, { status });
}

/** Parse the JSON body against a schema; throws a Response on failure. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw fail("Body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw fail(formatZod(parsed.error));
  return parsed.data;
}

function formatZod(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

/** Run a handler and turn thrown errors into a JSON envelope. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof DslError) return fail(e.message, 400, { position: e.position });
    const message = e instanceof Error ? e.message : String(e);
    const isClientError = /Invalid field|Numeric comparison|not allowed|Only SELECT/i.test(message);
    if (!isClientError) console.error("[api]", e);
    return fail(isClientError ? message : sanitize(message), isClientError ? 400 : 500);
  }
}

function sanitize(message: string): string {
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up/i.test(message)) {
    const url = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
    return `Cannot reach ClickHouse at ${url}. Set CLICKHOUSE_URL (and reader/writer credentials) to point at a running server.`;
  }
  // ClickHouse errors are useful to the user (they wrote the query); trim the noisy tail.
  return message.split("\n")[0].slice(0, 500);
}
