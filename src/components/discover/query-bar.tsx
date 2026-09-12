"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon, CornerDownLeftIcon } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onSubmit: (q: string) => void;
  error?: { message: string; position?: number } | null;
  loading?: boolean;
};

export function QueryBar({ value, onSubmit, error, loading }: Props) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  // Reset the draft when the committed query changes (URL navigation, click-to-filter).
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dirty = draft !== value;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "group relative flex h-10 items-center gap-2 rounded-md border bg-card/60 px-3 font-mono text-sm transition-colors",
          "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
          error && "border-destructive/60",
        )}
      >
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(draft);
            if (e.key === "Escape") setDraft(value);
          }}
          spellCheck={false}
          placeholder='level:error service:api "connection timeout" http.status>=500'
          className="h-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center gap-2 text-muted-foreground">
          {loading && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
          {dirty ? (
            <button
              onClick={() => onSubmit(draft)}
              className="flex items-center gap-1 rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
            >
              Run <CornerDownLeftIcon className="size-3" />
            </button>
          ) : (
            <Kbd className="hidden opacity-60 group-focus-within:hidden sm:inline-flex">/</Kbd>
          )}
        </div>
      </div>
      {error && (
        <div className="fade-up flex items-baseline gap-2 px-1 font-mono text-xs text-destructive">
          {error.position !== undefined && (
            <span className="text-muted-foreground">col {error.position + 1}</span>
          )}
          {error.message}
        </div>
      )}
    </div>
  );
}
