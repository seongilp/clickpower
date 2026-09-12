/** Core columns of clickpower.logs. Everything else lives under `attributes`. */
export const CORE_FIELDS = ["timestamp", "level", "service", "host", "message", "trace_id", "span_id"] as const;
export type CoreField = (typeof CORE_FIELDS)[number];

const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function isCoreField(f: string): f is CoreField {
  return (CORE_FIELDS as readonly string[]).includes(f);
}

export function isValidField(f: string): boolean {
  return FIELD_RE.test(f);
}

/** Resolve a user-facing field name to a ClickHouse expression (without casting). */
export function resolveField(field: string): { expr: string; core: boolean } {
  if (!isValidField(field)) throw new Error(`Invalid field name: ${field}`);
  if (isCoreField(field)) return { expr: field, core: true };
  const path = field.startsWith("attributes.") ? field : `attributes.${field}`;
  return { expr: path, core: false };
}
