# ClickHouse vs DuckDB on the same log data

Run it yourself:

```bash
docker compose up -d clickhouse
pnpm seed -- --backfill=1440 --rate=116 --once   # ~10M rows over a 24h window
pnpm bench                                        # add --runs=11 for more samples
```

`scripts/bench.mjs` exports `clickpower.logs` to Parquet, loads it into two DuckDB
databases (as-exported, and sorted by the same key ClickHouse orders by), then runs
the query shapes the Discover UI issues against all three. Every query is warmed once,
then sampled; the numbers below are medians.

Both fixtures span a 24-hour window, so the `24h` queries touch the whole table and the
`1h` queries touch roughly a twenty-fourth of it. Apple Silicon laptop, single node.

## 10M rows (10,022,400)

| query | ClickHouse | DuckDB unsorted | DuckDB sorted |
|---|---|---|---|
| range 1h, `ORDER BY ts DESC LIMIT 200` | 3.8ms | **3.0ms** | 3.8ms |
| level+service 24h, `ORDER BY ts DESC LIMIT 200` | 3.2ms | **3.1ms** | 6.8ms |
| full-text `deadlock` 24h, `ORDER BY ts DESC LIMIT 200` | **11.9ms** | 50.1ms | 23.2ms |
| histogram 5m × level, 24h | 27.0ms | 23.0ms | **22.9ms** |
| JSON `http.status >= 500` count, 24h | **11.5ms** | 87.8ms | 90.5ms |
| JSON `http.route` top values, 24h | **31.4ms** | 85.0ms | 87.5ms |
| full sort `ORDER BY message LIMIT 200` | 31.1ms | 18.3ms | **16.1ms** |

## 1M rows (1,014,540)

| query | ClickHouse | DuckDB unsorted | DuckDB sorted |
|---|---|---|---|
| range 1h, `ORDER BY ts DESC LIMIT 200` | 2.8ms | 1.3ms | **1.1ms** |
| level+service 24h, `ORDER BY ts DESC LIMIT 200` | 2.3ms | **1.3ms** | 1.7ms |
| full-text `deadlock` 24h, `ORDER BY ts DESC LIMIT 200` | **4.6ms** | 7.6ms | 8.2ms |
| histogram 5m × level, 24h | 7.2ms | 4.9ms | **4.8ms** |
| JSON `http.status >= 500` count, 24h | **4.7ms** | 14.4ms | 15.4ms |
| JSON `http.route` top values, 24h | **8.8ms** | 13.7ms | 15.0ms |
| full sort `ORDER BY message LIMIT 200` | 7.4ms | 3.0ms | **3.0ms** |

ClickHouse times are server-side. Wall-clock adds roughly 2-3ms of HTTP round trip on top;
DuckDB runs in-process with no such cost.

## How each engine scales from 1M to 10M

Ten times the data, and the multiplier each engine paid for it:

| query | ClickHouse | DuckDB |
|---|---|---|
| full-text `deadlock` | 2.6× | 6.6× |
| JSON `http.status >= 500` count | 2.4× | 6.1× |
| JSON `http.route` top values | 3.6× | 6.2× |
| histogram 5m × level | 3.8× | 4.7× |
| full sort `ORDER BY message` | 4.2× | 6.1× |

This is the whole story in one table. ClickHouse grows sublinearly on anything a
partition or a skip index can prune. DuckDB grows close to linearly because it scans.

## Reading it

**The ranking flips between the two sizes.** At 1M, DuckDB won the sort- and range-heavy
queries by 2-3× and everything finished under 16ms, so the choice did not matter. At 10M,
the queries that a log UI actually issues all over the place have moved to ClickHouse:

- **Full-text went from a wash to a 4× ClickHouse win.** The `tokenbf_v1` index on `message`
  skips granules that cannot contain the token; DuckDB regex-scans all ten million rows.
- **JSON field access widened to 7.6×.** The ClickHouse `JSON` type stores each discovered
  path as its own subcolumn, so `attributes.http.status` reads one column. DuckDB parses
  JSON text per row, and that cost tracks row count exactly.
- **Time-bounded top-N stayed a tie.** Both engines prune well by timestamp, and at 3ms
  nobody notices.

**DuckDB still wins the unfiltered full sort**, 16ms against 31ms, and it will keep winning
that one. Sorting ten million strings in memory with no predicate is exactly what a
vectorised single-node engine is built for. It is also not a query any log UI sends.

**Pre-sorting the DuckDB table finally does something at 10M**, halving the full-text scan
(50ms to 23ms) by grouping similar messages for better string compression. It costs you on
`level+service` (3.1ms to 6.8ms) and does nothing elsewhere. Not a lever worth pulling.

## What this does not measure

The benchmark reads a frozen snapshot with a warm cache. A log platform never does that:

- continuous high-rate inserts while queries run
- many concurrent readers, plus the alert scheduler and the ingest path
- retention: partition pruning and TTL expiry over weeks, not hours
- cold cache, and volumes past the point where the working set stops fitting in RAM

Those are ClickHouse's home ground, and DuckDB's single-process, single-writer model is the
wrong shape for them. The 10M numbers above already point that way; the gap only widens.

DuckDB stays interesting for a zero-install demo or an embedded mode over Parquet in object
storage, where its in-process startup and Parquet reader are the whole value proposition.
