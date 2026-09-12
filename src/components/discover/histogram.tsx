"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEVELS, LEVEL_COLORS, normalizeLevel } from "@/lib/levels";
import { formatTs } from "@/lib/time";
import type { HistogramResponse } from "@/lib/api-client";

type Props = {
  data?: HistogramResponse;
  range: { from: number; to: number };
  onSelectRange?: (from: number, to: number) => void;
};

type Row = { t: number } & Partial<Record<(typeof LEVELS)[number], number>>;

export function Histogram({ data, range, onSelectRange }: Props) {
  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const step = data.stepSeconds * 1000;
    const start = Math.floor(range.from / step) * step;
    const byT = new Map<number, Row>();
    for (let t = start; t < range.to; t += step) byT.set(t, { t });
    for (const b of data.buckets) {
      const row = byT.get(b.t) ?? { t: b.t };
      const lvl = normalizeLevel(b.level);
      row[lvl] = (row[lvl] ?? 0) + b.c;
      byT.set(b.t, row);
    }
    return [...byT.values()].sort((a, b) => a.t - b.t);
  }, [data, range]);

  const total = useMemo(() => data?.buckets.reduce((s, b) => s + b.c, 0) ?? 0, [data]);
  const stepMs = (data?.stepSeconds ?? 60) * 1000;

  return (
    <div className="log-grid-bg relative h-36 rounded-md border bg-card/40">
      <div className="pointer-events-none absolute top-2 left-3 z-10 flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground">
        <span className="text-foreground tabular">{total.toLocaleString()}</span> events
        <span className="opacity-60">· {data ? `${data.stepSeconds}s buckets` : "…"}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, left: 8, bottom: 0 }} barCategoryGap={1}
          onClick={(e) => {
            const t = e?.activeLabel !== undefined ? Number(e.activeLabel) : NaN;
            if (!Number.isNaN(t) && onSelectRange) onSelectRange(t, t + stepMs);
          }}
        >
          <XAxis
            dataKey="t"
            tickFormatter={(v: number) => formatTs(v, { seconds: false }).slice(11)}
            tick={{ fontSize: 10, fontFamily: "var(--font-jetbrains)", fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "oklch(1 0 0 / 5%)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-md border bg-popover p-2 font-mono text-[11px] shadow-xl">
                  <div className="mb-1 text-muted-foreground">{formatTs(Number(label))}</div>
                  {[...payload].reverse().map((p) => (
                    <div key={String(p.dataKey)} className="flex justify-between gap-4">
                      <span style={{ color: p.color }}>{String(p.dataKey)}</span>
                      <span className="tabular">{Number(p.value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          {[...LEVELS].reverse().map((l) => (
            <Bar key={l} dataKey={l} stackId="a" fill={LEVEL_COLORS[l]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
