CREATE DATABASE IF NOT EXISTS clickpower;
CREATE DATABASE IF NOT EXISTS clickpower_meta;

CREATE TABLE IF NOT EXISTS clickpower.logs
(
    timestamp   DateTime64(3, 'UTC') CODEC(Delta, ZSTD),
    level       LowCardinality(String),
    service     LowCardinality(String),
    host        LowCardinality(String),
    message     String CODEC(ZSTD(3)),
    trace_id    String,
    span_id     String,
    attributes  JSON,
    INDEX idx_msg   message  TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4,
    INDEX idx_trace trace_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (service, level, timestamp)
TTL toDateTime(timestamp) + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS clickpower_meta.saved_searches
(
    id          String,
    name        String,
    query       String,
    columns     Array(String),
    deleted     UInt8 DEFAULT 0,
    updated_at  DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY id;

CREATE TABLE IF NOT EXISTS clickpower_meta.dashboards
(
    id          String,
    name        String,
    spec        String,
    deleted     UInt8 DEFAULT 0,
    updated_at  DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY id;

CREATE TABLE IF NOT EXISTS clickpower_meta.alert_rules
(
    id          String,
    name        String,
    spec        String,
    enabled     UInt8 DEFAULT 1,
    deleted     UInt8 DEFAULT 0,
    updated_at  DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY id;

CREATE TABLE IF NOT EXISTS clickpower_meta.alert_events
(
    id          String,
    rule_id     String,
    state       LowCardinality(String),
    value       Float64,
    fired_at    DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
ORDER BY (rule_id, fired_at);
