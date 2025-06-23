import { Val, F, A, match, N } from "./util";
import { glyphs, PrimitiveKind, prims, subscripts } from "./glyphs";
function primitiveByGlyph(s: string) {
  return Object.values(prims).find((v) => v.glyph === s)!.def;
}
const basic = {
  string: /^"(\\.|[^"])*"/,
  character: /^'(\\.|[^'\\])*'/,
  identifier: /^[A-Z][A-Za-z]*/,
  number: /^\d+(\.\d+)?/,
  semi: /^;/,
  comment: /^⍝.*/m,
  space: /^ +/,
  newline: /^\n/,
  other: /^[^'"A-Z# \n;]+/,
};
type SyntaxName = {
  [K in keyof typeof glyphs as (typeof glyphs)[K]["kind"] extends "syntax"
    ? (typeof glyphs)[K]["name"]
    : never]: 1;
};
type TokenKind =
  | keyof Omit<typeof basic & SyntaxName, "other" | "semi">
  | PrimitiveKind
  | "constant";
export type Token = { kind: TokenKind; line: number; image: string };
export function lex(source: string) {
  const o: Token[] = [];
  let line = 1;
  lex: while (source.length) {
    const cur = source.slice(0, 10);
    if (source[0] === "#") source = glyphs["#"].glyph + source.slice(1);
    findtok: for (const [bkind, reg] of Object.entries(basic)) {
      const mat = source.match(reg);
      if (!mat) continue;
      let [m] = mat;
      source = source.slice(m.length);
      if (bkind === "semi") continue lex;
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
        const brack = m.match(/^(<<|>>)/);
        if (brack) {
          const g = glyphs[brack[0] as "<<" | ">>"];
          o.push({ kind: g.name, line, image: g.glyph });
          m = m.slice(brack[0].length);
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
            const a = subscripts[subscripts.indexOf(m[0]) % 3] ?? "";
            m = m.slice(a.length);
            image += a;
          }
          o.push({ kind: name, line, image });
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
  | { kind: "list"; values: AstNode[] }
  | { kind: "dfn"; def: AstNode }
  | { kind: "dfn arg"; left: boolean };

export class Parser {
  private i = 0;
  private line = 1;
  constructor(private tokens: Token[]) {}
  error(msg: string) {
    return new Error(`Parsing error on line ${this.line}: ` + msg);
  }
  expected(exp: string, act: Token | undefined) {
    const got = act ? `${act.kind}: ${act.image}` : "end of input";
    return this.error(`expected ${exp} but got ${got}`);
  }
  tok(): Token | undefined {
    let tok = this.tokens[this.i];
    if (tok) this.line = tok.line;
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
      return { kind: "string", value: eval(tok.image.replaceAll("\n", "\\n")) };
    } else if (tok.kind === "character") {
      this.i++;
      const str: string = eval(tok.image.replaceAll("\n", "\\n"));
      if (str.length !== 1)
        throw this.error(
          `character literal must be one character: ${tok.image}`,
        );
      return {
        kind: "character",
        value: str.codePointAt(0)!,
      };
    } else if (tok.kind.includes("dfn argument")) {
      this.i++;
      return { kind: "dfn arg", left: tok.image === "x" };
    } else if (tok.kind === "identifier") {
      this.i++;
      return { kind: "reference", name: tok.image };
    } else if (tok.kind === "open parenthesis") {
      return this.parenthesized();
    } else if (tok.kind === "open array") {
      return this.array();
    } else if (tok.kind === "open list") {
      return this.list();
    } else if (tok.kind === "open dfn") {
      return this.dfn();
    } else if (tok.kind === "constant") {
      this.i++;
      return { kind: "glyph reference", arity: 0, glyph: tok.image };
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
    if (!expr) throw this.error("Parentheses may not be empty");
    const tok = this.tok();
    if (tok?.kind !== "close parenthesis")
      throw this.expected("closing parenthesis", tok);
    this.i++;
    return expr;
  }
  list(): AstNode {
    this.i++;
    const values: AstNode[] = [];
    let m = this.expression();
    if (!m) {
      const t = this.tok();
      if (t?.kind !== "close list") throw this.expected("expression or ⟩", t);
      this.i++;
      return { kind: "list", values: [] };
    }
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind === "close list") {
        this.i++;
        break;
      }
      if (t?.kind !== "separator") throw this.expected("⟩ or ,", t);
      this.i++;
      m = this.expression();
      if (!m) throw this.expected("expression after separator", this.tok());
    }
    return { kind: "list", values };
  }
  array(): AstNode {
    this.i++;
    const values: AstNode[] = [];
    let m = this.expression();
    if (!m) throw this.expected("expression in array literal", this.tok());
    while (m) {
      values.push(m);
      const t = this.tok();
      this.i++;
      if (t?.kind === "close array") break;
      if (t?.kind !== "separator") throw this.expected("] or ,", t);
      m = this.expression();
      if (!m) throw this.expected("expression after separator", this.tok());
    }
    return { kind: "array", values };
  }
  dfn(): AstNode {
    this.i++;
    const m = this.expression();
    if (!m) throw this.expected("dfn body", this.tok());
    const tok = this.tok();
    if (tok?.kind !== "close dfn") throw this.expected("close dfn", tok);
    this.i++;
    return { kind: "dfn", def: m };
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
    let p = this.strand();
    if (!p) return;
    while (true) {
      p = this.monadicModifierStack(p);
      const tok = this.tokens[this.i];
      if (tok?.kind !== "dyadic modifier") return p;
      this.i++;
      const r = this.strand();
      if (!r)
        throw this.expected("right argument to dyadic modifier", this.tok());
      p = { kind: "dyadic modifier", glyph: tok.image, fns: [p!, r] };
    }
  }
  strand(): AstNode | void {
    const values: AstNode[] = [];
    let m = this.primary();
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind !== "ligature") break;
      this.i++;
      m = this.primary();
      if (!m) {
        throw this.error("strand cannot end with a ligature");
      }
    }
    if (values.length === 0) return;
    if (values.length === 1) return values[0];
    return { kind: "strand", values };
  }
  expression(): AstNode | void {
    const values: AstNode[] = [];
    while (true) {
      const m = this.modifierExpression();
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
    const declaredArity = subscripts.indexOf(tok2.image[1]);
    return {
      kind: "binding",
      name: tok1.image,
      declaredArity,
      value: this.expression()!,
    };
  }
  program() {
    const statements: AstNode[] = [];
    while (this.tok()) {
      if (this.tok()?.kind === "newline") {
        this.i++;
        continue;
      }
      const e = this.binding() ?? this.expression();
      if (!e) throw this.expected("statement", this.tok());
      statements.push(e);
    }
    return statements;
  }
}

export class Visitor {
  public bindings = new Map<string, Val>();
  private thisBinding?: [string, number];
  private dfns?: Val[];
  visit(node: AstNode): Val {
    if (node.kind === "number" || node.kind === "character") {
      return { kind: node.kind, data: node.value };
    } else if (node.kind === "string") {
      return {
        kind: "array",
        shape: [node.value.length],
        data: [...node.value].map<Val>((c) => ({
          kind: "character",
          data: c.codePointAt(0)!,
        })),
      };
    } else if (node.kind === "glyph reference") {
      if (node.arity === 0) return primitiveByGlyph(node.glyph)();
      return F(node.arity, primitiveByGlyph(node.glyph));
    } else if (node.kind === "monadic modifier") {
      return primitiveByGlyph(node.glyph)(this.visit(node.fn));
    } else if (node.kind === "dyadic modifier") {
      return primitiveByGlyph(node.glyph)(
        ...node.fns.map((f) => this.visit(f)),
      );
    } else if (node.kind === "expression") {
      const tines = node.values.map((n) => this.visit(n));
      if (tines.length === 1) return tines[0];
      type Cmp = (r: Val & { kind: "function" }) => Val & { kind: "function" };
      const fns: Cmp[] = [];
      function fork(x: Val, g: Val & { kind: "function" }): Cmp {
        const l = x.kind === "function" ? x : F(0, (_) => x);
        return (r) => {
          const arity = Math.max(r.arity, l.arity);
          const rgt =
            arity === 2 && r.arity === 1 ? F(2, (_, w) => r.data(w)) : r;
          const lft =
            arity === 2 && l.arity === 1 ? F(2, (_, w) => l.data(w)) : l;
          return F(arity, (...v) => g.data(lft.data(...v), rgt.data(...v)));
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
          t ??= F(1, (y) => y);
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
    } else if (node.kind === "strand" || node.kind === "list") {
      return A(
        [node.values.length],
        node.values.map((v) => this.visit(v)),
      );
    } else if (node.kind === "array") {
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
    } else if (node.kind === "reference") {
      if (this.thisBinding?.[0] === node.name) {
        const arity = this.thisBinding[1];
        if (arity === -1)
          throw new Error(
            `Recursive binding ${node.name} must declare its arity`,
          );
        return F(arity, (...v) => {
          const g = this.bindings.get(node.name) as Val & { kind: "function" };
          return g.data(...v);
        });
      } else if (this.bindings.has(node.name))
        return this.bindings.get(node.name)!;
      throw new Error(`Unrecognized identifier '${node.name}'`);
    } else if (node.kind === "binding") {
      const { name, declaredArity, value } = node;
      this.thisBinding = [name, declaredArity];
      const v = this.visit(value);
      if (
        (declaredArity > 0 &&
          (v.kind !== "function" || v.arity !== declaredArity)) ||
        (declaredArity === 0 && v.kind === "function")
      ) {
        const inferred = v.kind === "function" ? v.arity : 0;
        throw new Error(
          `in ${name}: arity was declared ${declaredArity} but inferred ${inferred}`,
        );
      }
      this.thisBinding = undefined;
      this.bindings.set(node.name, v);
      return v;
    } else if (node.kind === "dfn") {
      function getArity(node: AstNode): number {
        if (node.kind === "dfn arg") return node.left ? 2 : 1;
        if (
          node.kind === "expression" ||
          node.kind === "array" ||
          node.kind === "list" ||
          node.kind === "strand"
        )
          return node.values.map(getArity).reduce((x, y) => Math.max(x, y), 1);
        return 1;
      }
      const arity = getArity(node.def);
      return F(arity, (...v) => {
        const temp = this.dfns?.slice();
        this.dfns = arity === 1 ? [N(0), v[0]] : v;
        const e = this.visit(node.def);
        this.dfns = temp;
        return e;
      });
    } else if (node.kind === "dfn arg") {
      if (!this.dfns)
        throw new Error("Cannot reference dfn argument outside dfn");
      return node.left ? this.dfns[0] : this.dfns[1];
    }
    throw new Error(
      "Interpreter error! Please report this as a bug!" +
        "\n" +
        JSON.stringify(node, null, 2),
    );
  }
}
