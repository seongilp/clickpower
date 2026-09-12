import { DslError, type CompareOp, type Node } from "./ast";
import { lex, type Token } from "./lexer";

/**
 * Grammar:
 *   or     := and ("OR" and)*
 *   and    := unary (("AND")? unary)*
 *   unary  := ("-" | "NOT")? primary
 *   primary:= "(" or ")" | word op word | word
 */
export function parse(input: string): Node | null {
  const tokens = lex(input);
  if (tokens.length === 0) return null;
  const p = new Parser(tokens, input.length);
  const node = p.parseOr();
  if (!p.done()) throw new DslError("Unexpected token", p.peek()!.pos);
  return node;
}

class Parser {
  private i = 0;
  constructor(private tokens: Token[], private end: number) {}

  done() { return this.i >= this.tokens.length; }
  peek(): Token | undefined { return this.tokens[this.i]; }
  private next(): Token { return this.tokens[this.i++]; }

  parseOr(): Node {
    const children = [this.parseAnd()];
    while (this.peek()?.kind === "or") { this.next(); children.push(this.parseAnd()); }
    return children.length === 1 ? children[0] : { type: "or", children };
  }

  parseAnd(): Node {
    const children = [this.parseUnary()];
    for (;;) {
      const t = this.peek();
      if (!t || t.kind === "or" || t.kind === "rparen") break;
      if (t.kind === "and") this.next();
      children.push(this.parseUnary());
    }
    return children.length === 1 ? children[0] : { type: "and", children };
  }

  parseUnary(): Node {
    const t = this.peek();
    if (t && (t.kind === "minus" || t.kind === "not")) {
      this.next();
      const inner = this.parsePrimary();
      return negate(inner, t.pos);
    }
    return this.parsePrimary();
  }

  parsePrimary(): Node {
    const t = this.next();
    if (!t) throw new DslError("Unexpected end of query", this.end);
    if (t.kind === "lparen") {
      const inner = this.parseOr();
      const close = this.next();
      if (!close || close.kind !== "rparen") throw new DslError("Missing closing paren", close?.pos ?? this.end);
      return inner;
    }
    if (t.kind !== "word") throw new DslError("Unexpected token", t.pos);
    const op = this.peek();
    if (op && op.kind === "op" && !t.quoted) {
      this.next();
      const v = this.next();
      if (!v || v.kind !== "word") throw new DslError("Expected value after operator", v?.pos ?? this.end);
      return { type: "term", field: t.value, op: normalizeOp(op.value), value: v.value, negated: false };
    }
    return { type: "text", value: t.value, negated: false };
  }
}

function normalizeOp(op: string): CompareOp {
  return (op === "=" ? ":" : op) as CompareOp;
}

function negate(node: Node, pos: number): Node {
  if (node.type === "term" || node.type === "text") return { ...node, negated: !node.negated };
  // De Morgan is overkill for a prototype: wrap groups in a NOT marker via an AND with negated flag is not modelled,
  // so we push negation down to leaves.
  if (node.type === "and") return { type: "or", children: node.children.map((c) => negate(c, pos)) };
  return { type: "and", children: node.children.map((c) => negate(c, pos)) };
}
