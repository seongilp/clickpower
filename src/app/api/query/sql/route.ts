import { handle, ok, parseBody } from "@/lib/api/respond";
import { runSelect } from "@/lib/query/run";
import { assertReadOnlySql, capSql } from "@/lib/query/sql-guard";
import { sqlRequestSchema } from "@/lib/query/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, sqlRequestSchema);
    assertReadOnlySql(body.sql);
    const { rows, stats } = await runSelect<Record<string, unknown>>(capSql(body.sql, body.limit), {});
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return ok({ rows, columns, stats });
  });
}
