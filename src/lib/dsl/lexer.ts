import { DslError } from "./ast";

export type Token =
  | { kind: "lparen"; pos: number }
  | { kind: "rparen"; pos: number }
  | { kind: "and"; pos: number }
  | { kind: "or"; pos: number }
  | { kind: "not"; pos: number }
  | { kind: "minus"; pos: number }
  | { kind: "word"; value: string; quoted: boolean; pos: number }
  | { kind: "op"; value: string; pos: number };

const OPS = [">=", "<=", "!=", ">", "<", ":", "="] as const;
const KEYWORDS: Record<string, Token["kind"]> = { AND: "and", OR: "or", NOT: "not" };

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { tokens.push({ kind: "lparen", pos: i }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rparen", pos: i }); i++; continue; }
    if (c === '"') {
      const end = input.indexOf('"', i + 1);
      if (end === -1) throw new DslError("Unterminated quote", i);
      tokens.push({ kind: "word", value: input.slice(i + 1, end), quoted: true, pos: i });
      i = end + 1;
      continue;
    }
    const op = OPS.find((o) => input.startsWith(o, i));
    if (op) { tokens.push({ kind: "op", value: op, pos: i }); i += op.length; continue; }
    if (c === "-" && isWordStartAt(input, i + 1) && lastIsBoundary(tokens)) {
      tokens.push({ kind: "minus", pos: i }); i++; continue;
    }
    const start = i;
    while (i < input.length && !/[\s()":=<>!]/.test(input[i])) i++;
    if (i === start) throw new DslError(`Unexpected character '${c}'`, i);
    const word = input.slice(start, i);
    const kw = KEYWORDS[word];
    if (kw) tokens.push({ kind: kw, pos: start } as Token);
    else tokens.push({ kind: "word", value: word, quoted: false, pos: start });
  }
  return tokens;
}

function isWordStartAt(input: string, i: number): boolean {
  return i < input.length && !/[\s()":=<>!-]/.test(input[i]);
}

/** `-` is negation only when it starts a term (not inside `web-3`). */
function lastIsBoundary(tokens: Token[]): boolean {
  const last = tokens[tokens.length - 1];
  return !last || last.kind !== "op";
}
