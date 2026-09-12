"use client";

import { useState } from "react";
import { ClockIcon, ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUICK_RANGES, describeRange, resolveExpr } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = { from: string; to: string; onChange: (from: string, to: string) => void };

export function TimePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [absFrom, setAbsFrom] = useState(from);
  const [absTo, setAbsTo] = useState(to);
  const [err, setErr] = useState<string | null>(null);

  const apply = () => {
    try {
      const f = resolveExpr(absFrom);
      const t = resolveExpr(absTo);
      if (t <= f) throw new Error("`to` must be after `from`");
      onChange(absFrom.trim(), absTo.trim());
      setErr(null);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 gap-2 bg-card/60 font-mono text-xs tabular">
            <ClockIcon className="size-3.5 text-primary" />
            {describeRange(from, to)}
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick</div>
        <div className="grid grid-cols-7 gap-1">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.from}
              onClick={() => { onChange(r.from, "now"); setOpen(false); }}
              className={cn(
                "rounded-sm border py-1 font-mono text-xs transition-colors hover:border-primary/50 hover:text-primary",
                from === r.from && to === "now" && "border-primary/70 bg-primary/10 text-primary",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Custom <span className="normal-case tracking-normal">(now-30m, ISO, epoch ms)</span>
        </div>
        <div className="flex flex-col gap-2">
          <Input value={absFrom} onChange={(e) => setAbsFrom(e.target.value)} className="font-mono text-xs" placeholder="from" />
          <Input value={absTo} onChange={(e) => setAbsTo(e.target.value)} className="font-mono text-xs" placeholder="to" />
          {err && <div className="font-mono text-xs text-destructive">{err}</div>}
          <Button size="sm" onClick={apply}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
