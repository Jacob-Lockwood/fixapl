import { Val, F, A, match, primitiveByGlyph } from "./primitives";
import { glyphs, PrimitiveKind } from "./glyphs";
const basic = {
  string: /^"(\\.|[^"$])*"/,
  character: /^'(\\.|[^'\\])*'/,
  identifier: /^[A-Z][A-Za-z]*/,
  number: /^\d+(\.\d+)?/,
  comment: /^#.*/m,
  space: /^ +/,
  newline: /^$/m,
  "open parenthesis": /^\(/,
  "close parenthesis": /^\)/,
  "open array": /^\[/,
  "close array": /^\]/,
  other: /^[^'"A-Z# \n()\[\]]+/,
};
type SyntaxName = {
  [K in keyof typeof glyphs as (typeof glyphs)[K]["kind"] extends "syntax"
    ? (typeof glyphs)[K]["name"]
    : never]: 1;
};
type TokenKind = keyof Omit<typeof basic & SyntaxName, "other"> | PrimitiveKind;
export type Token = { kind: TokenKind; line: number; image: string };
export function lex(source: string) {
  const o: Token[] = [];
  let line = 1;
  lex: while (source.length) {
    const cur = source.slice(0, 10);
    findtok: for (const [bkind, reg] of Object.entries(basic)) {
      const mat = source.match(reg);
      if (!mat) continue;
      let [m] = mat;
      source = source.slice(m.length);
      if (bkind !== "other") {
        o.push({ kind: bkind as TokenKind, line, image: m });
        continue lex;
      }
      m = m.replaceAll("`", glyphs.ng.glyph);
      other: while (m.length) {
        const num = m.match(basic.number);
        if (num) {
          o.push({ kind: "number", line, image: num[0] });
          m = m.slice(num[0].length);
          continue other;
        }
        const en = Object.entries(glyphs).find(
          ([alias, { glyph }]) => m.startsWith(glyph) || m.startsWith(alias),
        );
        if (!en) break findtok;
        const [alias, { glyph, name, kind }] = en;
        const x = m.startsWith(alias) ? alias : glyph;
        m = m.slice(x.length);
        if (name === "negate") {
          const match = m.match(basic.number);
          if (match) {
            const n = match[0];
            m = m.slice(n.length);
            o.push({ kind: "number", line, image: glyph + n });
            continue other;
          }
        }
        if (kind === "syntax") {
          let image = glyph;
          if (name === "binding") {
            const d = "⓪①②012";
            const a = d[d.indexOf(m[1]) % 3] ?? "";
            m = m.slice(a.length);
            image += a;
          }
          o.push({ kind: name, line, image: glyph });
        } else {
          o.push({ kind, line, image: glyph });
        }
      }
      continue lex;
    }
    throw new Error(`Lexing error on line ${line} near ${cur}`);
  }
  return o;
}

type AstNode =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "character"; value: number }
  | { kind: "monadic modifier"; glyph: string; fn: AstNode }
  | { kind: "dyadic modifier"; glyph: string; fns: [AstNode, AstNode] }
  | { kind: "reference"; name: string }
  | { kind: "glyph reference"; arity: number; glyph: string }
  | { kind: "binding"; name: string; declaredArity: number; value: AstNode }
  | { kind: "expression"; values: AstNode[] }
  | { kind: "strand"; values: AstNode[] }
  | { kind: "array"; values: AstNode[] }
  | { kind: "list"; values: AstNode[] };

export class Parser {
  private i = 0;
  constructor(private tokens: Token[]) {}
  tok(): Token | undefined {
    let tok = this.tokens[this.i];
    while (tok?.kind === "newline") {
      this.i++;
      tok = this.tokens[this.i];
    }
    return tok;
  }
  primary(): AstNode | void {
    const tok = this.tok();
    if (!tok) return;
    if (tok.kind === "number") {
      this.i++;
      return { kind: "number", value: Number(tok.image.replace("¯", "-")) };
    } else if (tok.kind === "string") {
      this.i++;
      return { kind: "string", value: eval(tok.image) };
    } else if (tok.kind === "character") {
      this.i++;
      const str: string = eval(tok.image);
      if (str.length !== 1)
        throw new Error(
          `Parsing error on line ${tok.line} - character literal must be one ` +
            `character: ${tok.image}`,
        );
      return {
        kind: "character",
        value: str.codePointAt(0)!,
      };
    } else if (tok.kind === "identifier") {
      this.i++;
      return { kind: "reference", name: tok.image };
    } else if (tok.kind === "open parenthesis") {
      return this.parenthesized();
    } else if (tok.kind === "open array") {
      return this.array();
    } else if (tok.kind === "open list") {
      return this.list();
    } else if (tok.kind.includes("function")) {
      this.i++;
      return {
        kind: "glyph reference",
        arity: tok.kind.includes("monadic") ? 1 : 2,
        glyph: tok.image,
      };
    }
  }
  parenthesized() {
    this.i++;
    const expr = this.expression();
    if (!expr) throw new Error("Parentheses may not be empty");
    const tok = this.tokens[this.i];
    if (tok?.kind !== "close parenthesis") {
      throw new Error(
        `Parsing error on line ${tok.line} - expected closing parenthesis ` +
          `but got ${tok.kind}: ${tok.image}`,
      );
    }
    this.i++;
    return expr;
  }
  list(): AstNode {
    this.i++;
    const values: AstNode[] = [];
    let m = this.expression();
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind === "close list") {
        this.i++;
        break;
      }
      if (t?.kind !== "separator") {
        throw new Error(
          `Parsing error on line ${t?.line} - expected ⟩ or ⋄ but got ${t?.kind}`,
        );
      }
      this.i++;
      m = this.expression();
      if (!m) {
        throw new Error(
          `Parsing error on line ${t.line} - list cannot end with a diamond`,
        );
      }
    }
    return { kind: "list", values };
  }
  array(): AstNode {
    this.i++;
    const values: AstNode[] = [];
    let m = this.expression();
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind === "close array") {
        this.i++;
        break;
      }
      if (t?.kind !== "separator") {
        throw new Error(
          `Parsing error on line ${t?.line} - expected ] or ⋄ but got ${t?.kind}`,
        );
      }
      this.i++;
      m = this.expression();
      if (!m) {
        throw new Error(
          `Parsing error on line ${t.line} - array cannot end with a separator`,
        );
      }
    }
    return { kind: "array", values };
  }
  monadicModifierStack(p: AstNode | void) {
    if (!p) return;
    while (true) {
      const tok = this.tokens[this.i];
      if (tok?.kind !== "monadic modifier") return p;
      this.i++;
      p = { kind: "monadic modifier", glyph: tok.image, fn: p };
    }
  }
  modifierExpression() {
    let p = this.primary();
    if (!p) return;
    while (true) {
      p = this.monadicModifierStack(p);
      const tok = this.tokens[this.i];
      if (tok?.kind !== "dyadic modifier") return p;
      this.i++;
      const r = this.primary();
      if (!r) {
        throw new Error(
          `Parsing error on line ${tok.line} - expected right argument to ` +
            `dyadic modifier but got ${tok.kind}: ${tok.image}`,
        );
      }
      p = { kind: "dyadic modifier", glyph: tok.image, fns: [p!, r] };
    }
  }
  strand(): AstNode | void {
    const values: AstNode[] = [];
    let m = this.modifierExpression();
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind !== "ligature") break;
      this.i++;
      m = this.modifierExpression();
      if (!m) {
        throw new Error(
          `Parsing error on line ${t.line} - strand cannot end with a ligature`,
        );
      }
    }
    if (values.length === 0) return;
    if (values.length === 1) return values[0];
    return { kind: "strand", values };
  }
  expression(): AstNode | void {
    const values: AstNode[] = [];
    while (true) {
      const m = this.strand();
      if (!m) break;
      values.push(m);
    }
    if (values.length !== 0) return { kind: "expression", values };
  }
  binding(): AstNode | void {
    const tok1 = this.tok();
    if (tok1?.kind !== "identifier") return;
    const tok2 = this.tokens[this.i + 1];
    if (tok2?.kind !== "binding") return;
    this.i += 2;
    const declaredArity = "⓪①②".indexOf(tok2.image[1]);
    return {
      kind: "binding",
      name: tok1.image,
      declaredArity,
      value: this.expression()!,
    };
  }
  program() {
    const statements: AstNode[] = [];
    while (this.i < this.tokens.length) {
      const b = this.binding();
      if (b) {
        statements.push(b);
      } else {
        const e = this.expression();
        if (!e) return statements;
        statements.push(e);
      }
    }
    return statements;
  }
}

//* Visit tree
//* if node is binding:
//* - if arity is declared, set it
//* - push name to stack
//* - visit value
//* - set value
export class Visitor {
  visit(node: AstNode): Val {
    if (node.kind === "number" || node.kind === "character") {
      return { kind: node.kind, data: node.value };
    }
    if (node.kind === "string") {
      return {
        kind: "array",
        shape: [node.value.length],
        data: [...node.value].map<Val>((c) => ({
          kind: "character",
          data: c.codePointAt(0)!,
        })),
      };
    }
    if (node.kind === "glyph reference") {
      return F(node.arity, primitiveByGlyph(node.glyph));
    }
    if (node.kind === "monadic modifier") {
      return primitiveByGlyph(node.glyph)(this.visit(node.fn));
    }
    if (node.kind === "dyadic modifier") {
      return primitiveByGlyph(node.glyph)(
        ...node.fns.map((f) => this.visit(f)),
      );
    }
    if (node.kind === "expression") {
      const tines = node.values.map((n) => this.visit(n));
      if (tines.length === 1) return tines[0];
      type Cmp = (r: Val & { kind: "function" }) => Val & { kind: "function" };
      const fns: Cmp[] = [];
      function fork(l: Val, g: Val & { kind: "function" }): Cmp {
        const isF = l.kind === "function";
        return (r) => {
          const arity = Math.max(r.arity, isF ? l.arity : 0);
          return F(arity, (x, y) => {
            const lft = isF ? (arity > l.arity ? l.data(y) : l.data(x, y)) : l;
            const rgt = arity > r.arity ? r.data(y) : r.data(x, y);
            return g.data(lft, rgt);
          });
        };
      }
      function atop(g: Val & { kind: "function" }): Cmp {
        if (g.arity === 2)
          return (r) => {
            if (r.arity === 0) return F(1, (x) => g.data(x, r.data()));
            return F(r.arity, (x, y) => g.data(x, r.data(x, y)));
          };
        return (r) => F(r.arity, (...v) => g.data(r.data(...v)));
      }
      for (let i = 0; ; i++) {
        let t = tines[i];
        const n = tines[i + 1];
        if (!n) {
          t ??= F(1, (...v) => v.at(-1)!);
          const s = t.kind === "function" ? t : F(0, () => t);
          const g = fns.reduceRight((r, fn) => fn(r), s);
          return g.arity === 0 ? g.data() : g;
        }
        if (n.kind === "function" && n.arity === 2) {
          i++;
          fns.push(fork(t, n));
        } else if (t.kind === "function") {
          fns.push(atop(t));
        } else throw new Error("Cannot have nilad outside of fork");
      }
    }
    if (node.kind === "strand" || node.kind === "list") {
      return A(
        [node.values.length],
        node.values.map((v) => this.visit(v)),
      );
    }
    if (node.kind === "array") {
      if (node.values.length === 0) {
        throw new Error("Square brackets may not be empty");
      }
      const v = node.values.map((n) => this.visit(n));
      if (v.every((d) => d.kind === "array")) {
        if (v.every((x, i) => match(x.shape, v[++i % v.length].shape))) {
          return A(
            [v.length, ...v[0].shape],
            v.flatMap((x) => x.data),
          );
        }
      } else if (!v.some((d) => d.kind === "array")) {
        return A([v.length], v);
      }
      throw new Error("Elements of array literal must have matching shapes");
    }
    throw new Error(
      "Error in 'visit' -- node: " + "\n" + JSON.stringify(node, null, 2),
    );
  }
}
