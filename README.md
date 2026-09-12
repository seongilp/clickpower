# clickpower

ClickHouse-native log platform. A lightweight ELK replacement: **ClickHouse** does the storage and querying, `clickpower` is the UI (log explorer, dashboards, alerts) and a thin ingest layer. **Vector** ships your logs in.

> Status: early prototype. Discover (log exploration) works end to end. Dashboards, ingest endpoints and alerts are next.

## Quick start (demo with fake logs)

```bash
docker compose --profile demo --profile full up --build
# → http://localhost:3000/discover
```

The `demo` profile runs a generator that backfills an hour of logs and streams ~50/s.

## Local development

```bash
docker compose up -d clickhouse          # ClickHouse on :8123 with schema + readonly user
cp .env.example .env.local
pnpm install
pnpm seed -- --backfill=120 --rate=20 --once   # fake logs
pnpm dev                                  # http://localhost:3000/discover
pnpm test                                 # unit tests (DSL parser, SQL builders)
pnpm e2e                                  # playwright, needs ClickHouse + seeded data
```

## Search syntax

```
level:error service:api "connection timeout" -host:web-3 http.status>=500 (region:us-east-1 OR region:eu-west-1)
```

| Syntax | Meaning |
|---|---|
| `word`, `"a phrase"` | full-text on `message` (token index / ILIKE) |
| `field:value`, `field:"v w"` | equality; `*` wildcard → LIKE |
| `field>=n`, `<`, `<=`, `>`, `!=` | comparisons (numeric for `< > <= >=`) |
| `-term`, `NOT term` | negation |
| `a b`, `a AND b`, `a OR b`, `( … )` | boolean logic; AND binds tighter |

Unknown fields resolve to the `attributes` JSON column (`http.status` → `attributes.http.status`). Every user value is bound as a ClickHouse query parameter; nothing is string-concatenated into SQL. SQL mode runs as a read-only ClickHouse user with a row cap.

## Architecture

```
Vector ──▶ ClickHouse ◀──▶ clickpower (Next.js: UI + /api/query/*)
            clickpower.logs         DSL → SQL, param-bound
            clickpower_meta.*       saved searches / dashboards / alerts (ReplacingMergeTree)
```

Schema: `docker/clickhouse/init/01_schema.sql`. Core columns (`timestamp, level, service, host, message, trace_id, span_id`) plus `attributes JSON`.

## Roadmap

1. Discover: live tail, saved searches, autocomplete
2. Dashboards (panels = saved DSL/SQL + chart type)
3. Ingest: `POST /api/ingest` (JSON lines) and OTLP/HTTP logs; bundled Vector config for files/syslog/docker
4. Alerts (query + threshold → webhook/Slack)

## License

Apache-2.0
