import { z } from "zod";
import { handle, ok, parseBody } from "@/lib/api/respond";
import { CORE_FIELDS } from "@/lib/dsl/fields";
import { buildFieldListSql } from "@/lib/query/builders";
import { runSelect } from "@/lib/query/run";
import { timeRangeSchema } from "@/lib/query/types";

const schema = z.object({ range: timeRangeSchema });

export async function POST(req: Request) {
  return handle(async () => {
    const { range } = await parseBody(req, schema);
    const { sql, params } = buildFieldListSql(range);
    const { rows } = await runSelect<{ path: string }>(sql, params);
    return ok({
      core: [...CORE_FIELDS],
      attributes: rows.map((r) => r.path),
    });
  });
}
