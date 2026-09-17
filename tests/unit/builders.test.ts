import { describe, it, expect } from "vitest";
import { buildLogsSql, buildHistogramSql, buildFieldValuesSql, pickStepSeconds } from "@/lib/query/builders";
import { assertReadOnlySql, assertSandboxedSql, capSql } from "@/lib/query/sql-guard";

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

describe("sandbox guard (in-process engine)", () => {
  it("allows plain queries against the logs table", () => {
    expect(() => assertSandboxedSql("SELECT count() FROM clickpower.logs")).not.toThrow();
  });

  it("blocks table functions that reach the filesystem or network", () => {
    for (const sql of [
      "SELECT * FROM file('/etc/passwd', LineAsString)",
      "SELECT * FROM url('http://example.com', LineAsString)",
      "SELECT * FROM s3('s3://b/k', CSV)",
      "SELECT * FROM remote('other:9000', default.x)",
      "SELECT * FROM mysql('h:3306','db','t','u','p')",
      "SELECT * FROM executable('x.sh', CSV)",
    ]) {
      expect(() => assertSandboxedSql(sql), sql).toThrow(/not allowed/i);
    }
  });

  it("tolerates whitespace between the function name and its paren", () => {
    expect(() => assertSandboxedSql("SELECT * FROM file ('/etc/passwd', LineAsString)")).toThrow();
  });

  it("blocks the system database and file redirection", () => {
    expect(() => assertSandboxedSql("SELECT * FROM system.settings")).toThrow(/system database/i);
    expect(() => assertSandboxedSql("SELECT 1 INTO OUTFILE '/tmp/x'")).toThrow(/files/i);
  });
});
