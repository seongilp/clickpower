import { levelColor, normalizeLevel } from "@/lib/levels";
import { cn } from "@/lib/utils";

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const norm = normalizeLevel(level);
  return (
    <span
      className={cn(
        "inline-flex h-4.5 w-12 items-center justify-center rounded-sm font-mono text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
      style={{ color: levelColor(norm), background: `color-mix(in oklch, ${levelColor(norm)} 14%, transparent)` }}
    >
      {norm}
    </span>
  );
}
