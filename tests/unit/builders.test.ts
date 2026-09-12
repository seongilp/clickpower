import { describe, it, expect } from "vitest";
import { buildLogsSql, buildHistogramSql, buildFieldValuesSql, pickStepSeconds } from "@/lib/query/builders";
import { assertReadOnlySql, capSql } from "@/lib/query/sql-guard";

const range = { from: 1_000, to: 2_000 };

describe("buildLogsSql", () => {
  it("binds time range and limit", () => {
    const out = buildLogsSql({ q: "", range, limit: 50, order: "desc" });
    expect(out.sql).toContain("timestamp >= fromUnixTimestamp64Milli({from:Int64})");
    expect(out.sql).toContain("ORDER BY timestamp DESC LIMIT {limit:UInt32}");
    expect(out.params).toEqual({ from: 1000, to: 2000, limit: 50 });
  });
  it("adds cursor and dsl filter", () => {
    const out = buildLogsSql({ q: "level:error", range, limit: 50, order: "desc", cursor: 1500 });
    expect(out.sql).toContain("level = {p0:String}");
    expect(out.sql).toContain("timestamp < fromUnixTimestamp64Milli({cursor:Int64})");
    expect(out.params).toMatchObject({ p0: "error", cursor: 1500 });
  });
});

describe("pickStepSeconds", () => {
  it("picks a nice step near range/buckets", () => {
    expect(pickStepSeconds(60 * 60 * 1000, 60)).toBe(60);
    expect(pickStepSeconds(24 * 60 * 60 * 1000, 100)).toBe(1800);
    expect(pickStepSeconds(15 * 60 * 1000, 100)).toBe(10);
  });
});

describe("buildHistogramSql", () => {
  it("groups by bucket and level", () => {
    const out = buildHistogramSql({ q: "", range: { from: 0, to: 3_600_000 }, buckets: 60 });
    expect(out.stepSeconds).toBe(60);
    expect(out.sql).toContain("GROUP BY t, level");
    expect(out.params.step).toBe(60);
  });
});

describe("buildFieldValuesSql", () => {
  it("uses toString for attribute paths", () => {
    const out = buildFieldValuesSql({ q: "", range, field: "http.route", limit: 5 });
    expect(out.sql).toContain("toString(attributes.http.route) AS v");
  });
  it("rejects invalid fields", () => {
    expect(() => buildFieldValuesSql({ q: "", range, field: "x; drop", limit: 5 })).toThrow();
  });
});

describe("sql guard", () => {
  it("allows selects and rejects writes", () => {
    expect(() => assertReadOnlySql("SELECT 1")).not.toThrow();
    expect(() => assertReadOnlySql("INSERT INTO t VALUES (1)")).toThrow();
    expect(() => assertReadOnlySql("SELECT 1; DROP TABLE t")).toThrow();
  });
  it("caps rows", () => {
    expect(capSql("SELECT * FROM logs;", 10)).toBe("SELECT * FROM (SELECT * FROM logs) LIMIT 10");
  });
});
