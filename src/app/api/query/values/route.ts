import { handle, ok, parseBody } from "@/lib/api/respond";
import { buildFieldValuesSql } from "@/lib/query/builders";
import { runSelect } from "@/lib/query/run";
import { fieldValuesRequestSchema } from "@/lib/query/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, fieldValuesRequestSchema);
    const { sql, params } = buildFieldValuesSql(body);
    const { rows, stats } = await runSelect<{ v: string; c: string }>(sql, params);
    const values = rows.map((r) => ({ value: r.v, count: Number(r.c) }));
    const total = values.reduce((s, v) => s + v.count, 0);
    return ok({ values, total, stats });
  });
}
