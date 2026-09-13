# ClickHouse vs DuckDB on the same log data

Run it yourself:

```bash
docker compose up -d clickhouse
pnpm seed -- --backfill=1440 --rate=10 --once   # ~865k rows over 24h
pnpm bench                                       # add --runs=11 for more samples
```

`scripts/bench.mjs` exports `clickpower.logs` to Parquet, loads it into two DuckDB
databases (as-exported, and sorted by the same key ClickHouse orders by), then runs
the query shapes the Discover UI issues against all three.

## Result at 1M rows

1,014,540 rows, Apple Silicon laptop, median of 7 warm runs.

| query | ClickHouse (server) | DuckDB unsorted | DuckDB sorted |
|---|---|---|---|
| range 1h, `ORDER BY ts DESC LIMIT 200` | 2.8ms | 1.3ms | 1.1ms |
| level+service 24h, `ORDER BY ts DESC LIMIT 200` | 2.3ms | 1.3ms | 1.7ms |
| full-text `deadlock` 24h, `ORDER BY ts DESC LIMIT 200` | 4.6ms | 7.6ms | 8.2ms |
| histogram 5m × level, 24h | 7.2ms | 4.9ms | 4.8ms |
| JSON `http.status >= 500` count, 24h | 4.7ms | 14.4ms | 15.4ms |
| JSON `http.route` top values, 24h | 8.8ms | 13.7ms | 15.0ms |
| full sort `ORDER BY message LIMIT 200` | 7.4ms | 3.0ms | 3.0ms |

ClickHouse wall-clock time adds roughly 2ms of HTTP round trip on top of the server
time shown; DuckDB runs in-process with no such cost.

## Reading it

**At this size neither engine is the bottleneck.** Every query lands under 16ms, so what
the user perceives is dominated by browser rendering and network latency, not the engine.

**Sorting and range scans favour DuckDB**, by roughly 2-3x. A million rows fits in memory,
so the sort itself is cheap and there is no round trip. The absolute numbers (1-3ms) make
the win invisible in practice.

**JSON field access favours ClickHouse**, by roughly 3x. The ClickHouse `JSON` type stores
each discovered path as its own subcolumn, while DuckDB's `JSON` is parsed text. Log
exploration is mostly field pivots, so this is the difference that shows up most often in
real use.

**Full-text search and histograms are a wash.**

**Pre-sorting the DuckDB table changes nothing** at this scale. Zone maps only start paying
off on much larger data.

## Why the project still runs on ClickHouse

The benchmark measures steady-state reads on a fixed snapshot, which is the workload where
DuckDB looks best. It does not measure what a log platform actually spends its life doing:

- continuous high-rate inserts while queries run
- many concurrent readers, plus the alert scheduler and the ingest path
- retention: partition pruning and TTL-based expiry over weeks of data
- the volumes where compression codecs and skip indexes decide whether a query returns at all

Those are ClickHouse's home ground and DuckDB's single-process, single-writer model is the
wrong shape for them. DuckDB remains interesting for a zero-install demo or an embedded mode
over Parquet in object storage; see the roadmap in the README.
