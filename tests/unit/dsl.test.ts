import { describe, it, expect } from "vitest";
import { parse } from "@/lib/dsl/parser";
import { compile } from "@/lib/dsl/compile";

describe("parse", () => {
  it("parses field:value terms", () => {
    expect(parse("level:error")).toEqual({
      type: "term", field: "level", op: ":", value: "error", negated: false,
    });
  });

  it("parses free text and quoted phrases", () => {
    expect(parse('"connection timeout"')).toEqual({
      type: "text", value: "connection timeout", negated: false,
    });
    expect(parse("timeout")).toEqual({ type: "text", value: "timeout", negated: false });
  });

  it("parses comparison operators", () => {
    expect(parse("status>=500")).toMatchObject({ field: "status", op: ">=", value: "500" });
    expect(parse("duration<10")).toMatchObject({ field: "duration", op: "<", value: "10" });
  });

  it("implicit AND between terms", () => {
    expect(parse("level:error service:api")).toEqual({
      type: "and",
      children: [
        { type: "term", field: "level", op: ":", value: "error", negated: false },
        { type: "term", field: "service", op: ":", value: "api", negated: false },
      ],
    });
  });

  it("OR has lower precedence than AND", () => {
    const ast = parse("a:1 b:2 OR c:3");
    if (!ast || ast.type !== "or") throw new Error("expected or node");
    expect(ast.children[0].type).toBe("and");
    expect(ast.children[1]).toMatchObject({ field: "c" });
  });

  it("parentheses group", () => {
    const ast = parse("a:1 (b:2 OR c:3)");
    expect(ast).toMatchObject({ type: "and", children: [{ field: "a" }, { type: "or" }] });
  });

  it("negation with - and NOT", () => {
    expect(parse("-level:debug")).toMatchObject({ negated: true, field: "level" });
    expect(parse("NOT level:debug")).toMatchObject({ negated: true, field: "level" });
  });

  it("quoted value with spaces", () => {
    expect(parse('message:"hello world"')).toMatchObject({ field: "message", value: "hello world" });
  });

  it("empty query returns null", () => {
    expect(parse("")).toBeNull();
    expect(parse("   ")).toBeNull();
  });

  it("throws a positioned error on unbalanced parens", () => {
    expect(() => parse("(a:1")).toThrow(/paren/i);
  });
});

describe("compile", () => {
  it("compiles core column equality with bound params", () => {
    const out = compile(parse("level:error")!);
    expect(out.sql).toBe("level = {p0:String}");
    expect(out.params).toEqual({ p0: "error" });
  });

  it("compiles free text against message with hasToken for single tokens", () => {
    const out = compile(parse("timeout")!);
    expect(out.sql).toBe("hasTokenCaseInsensitive(message, {p0:String})");
    expect(out.params).toEqual({ p0: "timeout" });
  });

  it("compiles phrases with ILIKE", () => {
    const out = compile(parse('"connection timeout"')!);
    expect(out.sql).toBe("message ILIKE {p0:String}");
    expect(out.params).toEqual({ p0: "%connection timeout%" });
  });

  it("wildcards become LIKE", () => {
    const out = compile(parse("service:api-*")!);
    expect(out.sql).toBe("service LIKE {p0:String}");
    expect(out.params).toEqual({ p0: "api-%" });
  });

  it("unknown fields map to attributes JSON path", () => {
    const out = compile(parse("http.status>=500")!);
    expect(out.sql).toBe("toFloat64OrNull(toString(attributes.http.status)) >= {p0:Float64}");
    expect(out.params).toEqual({ p0: 500 });
  });

  it("unknown field equality compares as string", () => {
    const out = compile(parse("region:us-east-1")!);
    expect(out.sql).toBe("toString(attributes.region) = {p0:String}");
  });

  it("explicit attributes. prefix is accepted", () => {
    const out = compile(parse("attributes.user_id:42")!);
    expect(out.sql).toBe("toString(attributes.user_id) = {p0:String}");
  });

  it("combines AND / OR / NOT with parens", () => {
    const out = compile(parse("level:error (service:a OR service:b) -host:web-3")!);
    expect(out.sql).toBe(
      "(level = {p0:String} AND (service = {p1:String} OR service = {p2:String}) AND NOT (host = {p3:String}))",
    );
    expect(out.params).toEqual({ p0: "error", p1: "a", p2: "b", p3: "web-3" });
  });

  it("rejects unsafe field names", () => {
    expect(() => compile(parse("a;drop:1")!)).toThrow(/field/i);
  });
});
