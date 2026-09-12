import { z } from "zod";

const schema = z.object({
  CLICKHOUSE_URL: z.string().url().default("http://localhost:8123"),
  CLICKHOUSE_WRITER_USER: z.string().default("default"),
  CLICKHOUSE_WRITER_PASSWORD: z.string().default(""),
  CLICKHOUSE_READER_USER: z.string().default("reader"),
  CLICKHOUSE_READER_PASSWORD: z.string().default(""),
});

export type ChConfig = z.infer<typeof schema>;

export function loadChConfig(env: NodeJS.ProcessEnv = process.env): ChConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid ClickHouse config: ${parsed.error.message}`);
  }
  return parsed.data;
}

export const LOGS_DB = "clickpower";
export const META_DB = "clickpower_meta";
export const LOGS_TABLE = `${LOGS_DB}.logs`;
