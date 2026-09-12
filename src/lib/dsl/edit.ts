/** Small helpers that edit a DSL query string (used by click-to-filter). */

function needsQuote(v: string): boolean {
  return /[\s()":=<>]/.test(v) || v === "";
}

export function formatValue(v: string): string {
  return needsQuote(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}

export function filterTerm(field: string, value: string, negate = false): string {
  return `${negate ? "-" : ""}${field}:${formatValue(value)}`;
}

/** Append a term unless the exact same term is already present. */
export function addFilter(q: string, field: string, value: string, negate = false): string {
  const term = filterTerm(field, value, negate);
  const opposite = filterTerm(field, value, !negate);
  const parts = q.trim() ? q.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/) : [];
  const without = parts.filter((p) => p !== opposite);
  if (without.includes(term)) return without.join(" ");
  return [...without, term].join(" ");
}

export function removeFilter(q: string, term: string): string {
  const parts = q.trim() ? q.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/) : [];
  return parts.filter((p) => p !== term).join(" ");
}
