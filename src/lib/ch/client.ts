import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { loadChConfig } from "./config";

type Role = "reader" | "writer";

const clients = new Map<Role, ClickHouseClient>();

function build(role: Role): ClickHouseClient {
  const cfg = loadChConfig();
  const isReader = role === "reader";
  return createClient({
    url: cfg.CLICKHOUSE_URL,
    username: isReader ? cfg.CLICKHOUSE_READER_USER : cfg.CLICKHOUSE_WRITER_USER,
    password: isReader ? cfg.CLICKHOUSE_READER_PASSWORD : cfg.CLICKHOUSE_WRITER_PASSWORD,
    request_timeout: 60_000,
    clickhouse_settings: isReader
      ? {}
      : { async_insert: 1, wait_for_async_insert: 0 },
  });
}

/** Read-only client (readonly user, capped execution time/rows). */
export function reader(): ClickHouseClient {
  return getOrCreate("reader");
}

/** Writer client for ingest + metadata CRUD. */
export function writer(): ClickHouseClient {
  return getOrCreate("writer");
}

function getOrCreate(role: Role): ClickHouseClient {
  const existing = clients.get(role);
  if (existing) return existing;
  const created = build(role);
  clients.set(role, created);
  return created;
}
