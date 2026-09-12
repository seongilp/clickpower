import { handle, ok, parseBody } from "@/lib/api/respond";
import { buildHistogramSql } from "@/lib/query/builders";
import { runSelect } from "@/lib/query/run";
import { histogramRequestSchema } from "@/lib/query/types";

type Bucket = { t: string; level: string; c: string };

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, histogramRequestSchema);
    const { sql, params, stepSeconds } = buildHistogramSql(body);
    const { rows, stats } = await runSelect<Bucket>(sql, params);
    const buckets = rows.map((r) => ({ t: Number(r.t), level: r.level, c: Number(r.c) }));
    return ok({ buckets, stepSeconds, stats });
  });
}
