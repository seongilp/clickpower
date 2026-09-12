import { z } from "zod";

export const timeRangeSchema = z.object({
  from: z.number().int().nonnegative(), // epoch ms
  to: z.number().int().nonnegative(),
}).refine((r) => r.to > r.from, { message: "to must be after from" });

export type TimeRange = z.infer<typeof timeRangeSchema>;

export const logsRequestSchema = z.object({
  q: z.string().max(4000).default(""),
  range: timeRangeSchema,
  limit: z.number().int().min(1).max(1000).default(200),
  cursor: z.number().int().optional(), // epoch ms of the last row seen (exclusive)
  order: z.enum(["desc", "asc"]).default("desc"),
});
export type LogsRequest = z.infer<typeof logsRequestSchema>;

export const histogramRequestSchema = z.object({
  q: z.string().max(4000).default(""),
  range: timeRangeSchema,
  buckets: z.number().int().min(10).max(500).default(100),
});
export type HistogramRequest = z.infer<typeof histogramRequestSchema>;

export const fieldValuesRequestSchema = z.object({
  q: z.string().max(4000).default(""),
  range: timeRangeSchema,
  field: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(10),
});
export type FieldValuesRequest = z.infer<typeof fieldValuesRequestSchema>;

export const sqlRequestSchema = z.object({
  sql: z.string().min(1).max(20000),
  limit: z.number().int().min(1).max(10000).default(500),
});
export type SqlRequest = z.infer<typeof sqlRequestSchema>;

export type LogRow = {
  timestamp: string;
  level: string;
  service: string;
  host: string;
  message: string;
  trace_id: string;
  span_id: string;
  attributes: Record<string, unknown>;
};

export type QueryStats = { elapsedMs: number; rowsRead: number; bytesRead: number };
