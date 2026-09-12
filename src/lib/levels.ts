export const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
export type Level = (typeof LEVELS)[number];

/** Hex mirrors of the --level-* CSS tokens (SVG fills can't read CSS vars via attributes). */
export const LEVEL_COLORS: Record<Level, string> = {
  fatal: "#e359c5",
  error: "#ee5c4a",
  warn: "#f2b544",
  info: "#63a9e6",
  debug: "#7f8594",
  trace: "#5c6170",
};

export function normalizeLevel(l: string): Level {
  const v = l.toLowerCase();
  if (v === "warning") return "warn";
  if (v === "err") return "error";
  if (v === "critical" || v === "crit" || v === "panic") return "fatal";
  return (LEVELS as readonly string[]).includes(v) ? (v as Level) : "info";
}

export function levelColor(l: string): string {
  return LEVEL_COLORS[normalizeLevel(l)];
}
