import type { Node, TermNode, TextNode } from "./ast";
import { resolveField } from "./fields";

export type Compiled = { sql: string; params: Record<string, string | number> };

type Ctx = { params: Record<string, string | number>; n: number };

/** Compile an AST into a ClickHouse WHERE fragment with bound `{pN:Type}` params. */
export function compile(node: Node): Compiled {
  const ctx: Ctx = { params: {}, n: 0 };
  const sql = emit(node, ctx);
  return { sql, params: ctx.params };
}

function bind(ctx: Ctx, value: string | number, type: "String" | "Float64"): string {
  const name = `p${ctx.n++}`;
  ctx.params[name] = value;
  return `{${name}:${type}}`;
}

function emit(node: Node, ctx: Ctx): string {
  switch (node.type) {
    case "and": return `(${node.children.map((c) => emit(c, ctx)).join(" AND ")})`;
    case "or": return `(${node.children.map((c) => emit(c, ctx)).join(" OR ")})`;
    case "text": return wrapNot(emitText(node, ctx), node.negated);
    case "term": return wrapNot(emitTerm(node, ctx), node.negated);
  }
}

function wrapNot(sql: string, negated: boolean): string {
  return negated ? `NOT (${sql})` : sql;
}

function emitText(node: TextNode, ctx: Ctx): string {
  const hasSpace = /\s/.test(node.value);
  const hasWild = node.value.includes("*");
  if (hasWild) return `message LIKE ${bind(ctx, toLike(node.value), "String")}`;
  if (hasSpace) return `message ILIKE ${bind(ctx, `%${node.value}%`, "String")}`;
  return `hasTokenCaseInsensitive(message, ${bind(ctx, node.value, "String")})`;
}

function emitTerm(node: TermNode, ctx: Ctx): string {
  const { expr, core } = resolveField(node.field);
  const isNumericOp = node.op === ">" || node.op === ">=" || node.op === "<" || node.op === "<=";
  if (isNumericOp) {
    const num = Number(node.value);
    if (Number.isNaN(num)) throw new Error(`Numeric comparison needs a number: ${node.field}${node.op}${node.value}`);
    const lhs = core ? expr : `toFloat64OrNull(toString(${expr}))`;
    return `${lhs} ${node.op} ${bind(ctx, num, "Float64")}`;
  }
  const lhs = core ? expr : `toString(${expr})`;
  if (node.value.includes("*")) {
    const cmp = node.op === "!=" ? "NOT LIKE" : "LIKE";
    return `${lhs} ${cmp} ${bind(ctx, toLike(node.value), "String")}`;
  }
  const cmp = node.op === "!=" ? "!=" : "=";
  return `${lhs} ${cmp} ${bind(ctx, node.value, "String")}`;
}

function toLike(v: string): string {
  return v.replace(/[%_]/g, (m) => `\\${m}`).replace(/\*/g, "%");
}
