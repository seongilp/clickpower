/**
 * Guards for raw SQL mode.
 *
 * Against a ClickHouse server the real protection is the read-only DB user, and
 * these checks only fail obvious cases earlier with a clearer message. In chDB
 * demo mode there is no DB user to hide behind: the engine runs in-process with
 * the deployment's own filesystem access, so the denylist below is load-bearing.
 */
const ALLOWED_START = /^\s*(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i;

/** Table functions that reach the filesystem, the network, or another database. */
const REMOTE_SOURCES = [
  "file", "fileCluster", "url", "urlCluster", "s3", "s3Cluster", "gcs", "hdfs", "hdfsCluster",
  "azureBlobStorage", "deltaLake", "iceberg", "hudi", "mysql", "postgresql", "mongodb", "redis",
  "sqlite", "jdbc", "odbc", "remote", "remoteSecure", "cluster", "clusterAllReplicas",
  "executable", "input", "dictionary",
];

const REMOTE_RE = new RegExp(`\\b(?:${REMOTE_SOURCES.join("|")})\\s*\\(`, "i");
const INFILE_OUTFILE_RE = /\b(?:INTO\s+OUTFILE|FROM\s+INFILE)\b/i;
const SYSTEM_DB_RE = /\bsystem\s*\./i;

export function assertReadOnlySql(sql: string): void {
  if (!ALLOWED_START.test(sql)) {
    throw new Error("Only SELECT / WITH / SHOW / DESCRIBE / EXPLAIN statements are allowed");
  }
  if (/;\s*\S/.test(sql)) {
    throw new Error("Multiple statements are not allowed");
  }
}

/**
 * Extra restrictions for an engine that runs in this process. Rejects anything that
 * could read outside the demo dataset.
 */
export function assertSandboxedSql(sql: string): void {
  if (INFILE_OUTFILE_RE.test(sql)) {
    throw new Error("Reading from or writing to files is not allowed in demo mode");
  }
  if (SYSTEM_DB_RE.test(sql)) {
    throw new Error("The system database is not available in demo mode");
  }
  const match = REMOTE_RE.exec(sql);
  if (match) {
    throw new Error(`Table function ${match[0].replace(/\s*\($/, "")}() is not allowed in demo mode`);
  }
}

/** Wrap a user SELECT so the row cap is enforced regardless of what they wrote. */
export function capSql(sql: string, limit: number): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (/^\s*(SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(trimmed)) return trimmed;
  return `SELECT * FROM (${trimmed}) LIMIT ${Math.floor(limit)}`;
}
