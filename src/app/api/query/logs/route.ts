import { handle, ok, parseBody } from "@/lib/api/respond";
import { buildLogsSql } from "@/lib/query/builders";
import { runSelect } from "@/lib/query/run";
import { logsRequestSchema, type LogRow } from "@/lib/query/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, logsRequestSchema);
    const { sql, params } = buildLogsSql(body);
    const { rows, stats } = await runSelect<LogRow>(sql, params);
    return ok({ rows, stats, sql });
  });
}
