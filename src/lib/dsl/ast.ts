export type CompareOp = ":" | "=" | "!=" | ">" | ">=" | "<" | "<=";

export type TermNode = {
  type: "term";
  field: string;
  op: CompareOp;
  value: string;
  negated: boolean;
};

export type TextNode = { type: "text"; value: string; negated: boolean };

export type AndNode = { type: "and"; children: Node[] };
export type OrNode = { type: "or"; children: Node[] };

export type Node = TermNode | TextNode | AndNode | OrNode;

export class DslError extends Error {
  constructor(message: string, public readonly position: number) {
    super(message);
    this.name = "DslError";
  }
}
