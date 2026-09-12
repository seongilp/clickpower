import { cn } from "@/lib/utils";

type Mode = "dsl" | "sql";

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex h-10 items-center rounded-md border bg-card/60 p-0.5 font-mono text-[11px] font-semibold">
      {(["dsl", "sql"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "h-full rounded-[4px] px-2.5 uppercase tracking-wider text-muted-foreground transition-colors",
            mode === m && "bg-primary/15 text-primary",
          )}
        >
          {m === "dsl" ? "search" : "sql"}
        </button>
      ))}
    </div>
  );
}
