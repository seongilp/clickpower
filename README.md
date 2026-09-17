# clickpower

ClickHouse-native log platform. A lightweight ELK replacement: **ClickHouse** does the storage and querying, `clickpower` is the UI (log explorer, dashboards, alerts) and a thin ingest layer. **Vector** ships your logs in.

> Status: early prototype. Discover (log exploration) works end to end. Dashboards, ingest endpoints and alerts are next.
>
> **Site:** https://seongilp.github.io/clickpower/ · **Live demo:** https://clickpower.vercel.app/discover

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
pnpm bench                                # ClickHouse vs DuckDB on the same data
```

## Two engines

`CLICKPOWER_ENGINE` selects where SQL runs. Both speak the same dialect and the same
`{pN:Type}` parameter binding, so the query layer is identical either way.

| value | engine | used for |
|---|---|---|
| `clickhouse` (default) | a ClickHouse server over HTTP, queried as a read-only user | real deployments |
| `chdb` | ClickHouse embedded in the Node process via [chDB](https://github.com/chdb-io/chdb) | the hosted demo, and local runs with no server |

Demo mode loads `demo/logs.parquet` into a MergeTree inside the chDB session at cold
start (~1s locally) rather than querying the file directly, so skip indexes work and
JSON paths become subcolumns. Timestamps are shifted forward at load so the fixture
always looks current. Because an in-process engine has no read-only DB user behind it,
SQL mode additionally denies the `file`/`url`/`s3` table functions and the system database.

```bash
pnpm demo:fixture                      # generate demo/logs.parquet (needs the optional chdb package)
CLICKPOWER_ENGINE=chdb pnpm dev        # no ClickHouse server required
```

`chdb` is an optional dependency (~340 MB, platform-specific). Skip it with
`pnpm install --no-optional` if you only ever talk to a real server.

## Pointing at a remote ClickHouse

`scripts/setup-remote.mjs` applies the schema, creates the read-only user, seeds demo
data and prints the env vars your deployment needs. Safe to re-run.

```bash
node scripts/setup-remote.mjs --url=https://host:8443 --password=secret
node scripts/setup-remote.mjs --url=https://host:8443 --password=secret --vercel   # push to Vercel
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

## Why ClickHouse

At a million rows DuckDB and ClickHouse trade blows and everything finishes under 16ms.
At ten million the ranking flips: ClickHouse is 4x faster on full-text and 7x on JSON field
access, because skip indexes and JSON subcolumns prune what DuckDB has to scan. Ten times
the data costs ClickHouse 2.4-4.2x and DuckDB 4.7-6.6x. Numbers, methodology and the
queries in [docs/benchmark.md](docs/benchmark.md).

## Roadmap

1. Discover: live tail, saved searches, autocomplete
2. Dashboards (panels = saved DSL/SQL + chart type)
3. Ingest: `POST /api/ingest` (JSON lines) and OTLP/HTTP logs; bundled Vector config for files/syslog/docker
4. Alerts (query + threshold → webhook/Slack)

## License

Apache-2.0
