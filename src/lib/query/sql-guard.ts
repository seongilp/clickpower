/**
 * Raw SQL mode runs as the readonly ClickHouse user, so the DB already blocks writes.
 * This guard only rejects obviously non-SELECT statements early for a clearer error.
 */
const ALLOWED_START = /^\s*(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i;

export function assertReadOnlySql(sql: string): void {
  if (!ALLOWED_START.test(sql)) {
    throw new Error("Only SELECT / WITH / SHOW / DESCRIBE / EXPLAIN statements are allowed");
  }
  if (/;\s*\S/.test(sql)) {
    throw new Error("Multiple statements are not allowed");
  }
}

/** Wrap a user SELECT so the row cap is enforced regardless of what they wrote. */
export function capSql(sql: string, limit: number): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (/^\s*(SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(trimmed)) return trimmed;
  return `SELECT * FROM (${trimmed}) LIMIT ${Math.floor(limit)}`;
}
