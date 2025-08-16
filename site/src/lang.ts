import {
  Val,
  A,
  F,
  N,
  C,
  match,
  execnilad,
  asyncMap,
  list,
  display,
  recur,
  isString,
  each,
  cells,
  graphemes,
  Fun,
  nilad,
} from "./util";
import { glyphs, PrimitiveKind, prims, subscripts } from "./glyphs";
import quads from "./quads";
function primitiveByGlyph(s: string) {
  return Object.values(prims).find((v) => v.glyph === s)!.def;
}
const basic = {
  string: /^"(\\.|[^"])*"/,
  character: /^'(\\.|[^'\\])*'/,
  identifier: /^[A-Z][A-Za-z0-9]*/,
  number: /^\d+(\.\d+)?/,
  comment: /^⍝.*(?=\n|$)/,
  space: /^ +/,
  newline: /^\n/,
  other: /^;*[^\d'"A-Z#⍝ \n;][^'"A-Z#⍝ \n;]*/,
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
      if (bkind !== "other") {
        o.push({ kind: bkind as TokenKind, line, image: m });
        line += m.split("\n").length - 1;
        continue lex;
      }
      m = m.replaceAll("`", glyphs.ng.glyph).replaceAll(";", "");
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
          const minf = m[0] === glyphs.inf.glyph ? m[0] : m.match(/^inf|/)![0];
          if (minf) {
            m = m.slice(minf.length);
            const image = glyph + minf.replace("inf", glyphs.inf.glyph);
            o.push({ kind: "number", line, image });
            continue other;
          }
          const mnum = m.match(basic.number);
          if (mnum) {
            const n = mnum[0];
            m = m.slice(n.length);
            o.push({ kind: "number", line, image: glyph + n });
            continue other;
          }
        }
        if (kind === "syntax") {
          let image: string = glyph;
          if (name === "quad") {
            const ident = source.match(basic.identifier);
            if (m === "" && ident) {
              source = source.slice(ident[0].length);
              o.push({ kind: name, line, image: glyph + ident[0] });
              continue other;
            }
          } else if (name === "binding") {
            let sub = subscripts[subscripts.indexOf(m[0]) % 3] ?? "";
            if (sub) {
              m = m.slice(1);
            } else if ("sb mn dy".includes(m.slice(0, 2))) {
              sub = subscripts[["sb", "mn", "dy"].indexOf(m.slice(0, 2))] ?? "";
              if (sub) m = m.slice(2);
            }
            image += sub;
          } else if (name === "scope") {
            if (m[0] === glyphs.inf.glyph) {
              image += m[0];
              m = m.slice(1);
            } else {
              const [level] = m.match(/^inf|\d*/)!;
              image += level.replace("inf", glyphs.inf.glyph);
              m = m.slice(level.length);
            }
          }
          o.push({ kind: name, line, image });
        } else {
          o.push({ kind, line, image: glyph });
        }
      }
      continue lex;
    }
    throw new Error(`Unrecognized token on line ${line} near ${cur}`);
  }
  return o;
}

export type AstNode =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "character"; value: number }
  | { kind: "monadic modifier"; glyph: string; fn: AstNode }
  | { kind: "dyadic modifier"; glyph: string; fns: [AstNode, AstNode] }
  | { kind: "reference"; name: string }
  | { kind: "scope reference"; level: number }
  | { kind: "glyph reference"; arity: number; glyph: string }
  | { kind: "quad"; name: string }
  | { kind: "binding"; name: string; declaredArity: number; value: AstNode }
  | { kind: "expression"; values: AstNode[] }
  | { kind: "strand"; values: AstNode[] }
  | { kind: "array"; values: AstNode[] }
  | { kind: "list"; values: AstNode[] }
  | { kind: "dfn"; def: AstNode }
  | { kind: "dfn arg"; left: boolean }
  | { kind: "namespace access"; left: AstNode; name: string }
  | { kind: "assignment"; left: AstNode };

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
    const tok = this.tokens[this.i];
    if (tok) this.line = tok.line;
    return tok;
  }
  primary(): AstNode | void {
    const tok = this.tok();
    if (!tok) return;
    if (tok.kind === "number") {
      this.i++;
      const val = tok.image
        .replace(glyphs.ng.glyph, "-")
        .replace(glyphs.inf.glyph, "Infinity");
      return { kind: "number", value: Number(val) };
    } else if (tok.kind === "string") {
      this.i++;
      return {
        kind: "string",
        value: eval(tok.image.replaceAll("\\\n", "").replaceAll("\n", "\\n")),
      };
    } else if (tok.kind === "character") {
      this.i++;
      const str: string = eval(tok.image.replaceAll("\n", "\\n"));
      if (graphemes(str).length !== 1)
        throw this.error(
          `character literal must be one character: ${tok.image}`,
        );
      return {
        kind: "character",
        value: str.codePointAt(0)!,
      };
    } else if (tok.kind.includes("dfn argument")) {
      this.i++;
      return { kind: "dfn arg", left: tok.kind.startsWith("left") };
    } else if (tok.kind === "identifier") {
      this.i++;
      return { kind: "reference", name: tok.image };
    } else if (tok.kind === "scope") {
      this.i++;
      const level = +tok.image.slice(1).replace(glyphs.inf.glyph, "Infinity");
      return { kind: "scope reference", level };
    } else if (tok.kind === "quad") {
      this.i++;
      return { kind: "quad", name: tok.image.slice(1) };
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
    if (!expr) throw this.expected("expression in parentheses", this.tok());
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
      const tok = this.tok();
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
    let m = this.namespaceAccess();
    while (m) {
      values.push(m);
      const t = this.tok();
      if (t?.kind !== "ligature") break;
      this.i++;
      m = this.namespaceAccess();
      if (!m) throw this.error("strand cannot end with a ligature");
    }
    if (values.length === 0) return;
    if (values.length === 1) return values[0];
    return { kind: "strand", values };
  }
  namespaceAccess(): AstNode | void {
    const p = this.primary();
    if (!p) return;
    if (this.tok()?.kind !== "namespace access") return p;
    this.i++;
    const name = this.tok();
    if (name?.kind !== "identifier") throw this.expected("identifier", name);
    this.i++;
    return { kind: "namespace access", left: p, name: name.image };
  }
  assignment(): AstNode | void {
    const l = this.modifierExpression();
    if (!l) return;
    if (this.tok()?.kind !== "inline assignment") return l;
    this.i++;
    return { kind: "assignment", left: l };
  }
  expression(): AstNode | void {
    const values: AstNode[] = [];
    while (true) {
      const assign = this.assignment();
      if (!assign) break;
      values.push(assign);
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
export type TextOptions = {
  text: string;
  fontSize: number;
  color?: number[];
  bg?: number[];
  fontFamily?: string;
};
export type ReplContext = {
  drawImage: (d: ImageData) => void;
  write: (s: string) => void;
  read: () => Promise<string | null>;
  drawText: (opts: TextOptions) => Promise<ImageData>;
};
const newScope = () => new Map<string, Val>([]);
export class Visitor {
  global = newScope();
  scopes = [this.global];
  bindings = new Map<string, Val>([]);
  q: ReturnType<typeof quads>;
  private thisBinding?: [string, number];
  private dfns?: Val[];
  constructor(ctx: ReplContext) {
    this.q = quads(ctx);
  }
  private exec = F(
    1,
    recur(async (exec, y) => {
      const err = (m: string) => new Error(`${glyphs.exc}y: ${m}`);
      if (!isString(y)) {
        if (y.kind !== "array")
          throw err("y must be a string or array of strings");
        const v = y.data.every((v) => v.kind === "character") ? cells(y, 1) : y;
        return each(exec, v);
      }
      const src = String.fromCodePoint(...y.data.map((v) => v.data));
      try {
        const toks = lex(src).filter(
          (t) => !"whitespace,comment".includes(t.kind),
        );
        const p = new Parser(toks);
        const e = p.expression()!;
        if (p.tok()) throw "y must contain a single expression";
        return this.visit(e);
      } catch (e) {
        throw err(e instanceof Error ? e.message : e + "");
      }
    }),
    glyphs.exc.glyph,
  );
  async visit(node: AstNode): Promise<Val> {
    if (node.kind === "number" || node.kind === "character") {
      return { kind: node.kind, data: node.value };
    } else if (node.kind === "string") {
      return list(graphemes(node.value).map(C));
    } else if (node.kind === "quad") {
      if (this.q.has(node.name)) return this.q.get(node.name)!;
      throw new Error(`Unrecognized quad ${node.name}`);
    } else if (node.kind === "glyph reference") {
      if (node.glyph === glyphs.exc.glyph) return this.exec;
      if (node.arity === 0) return await primitiveByGlyph(node.glyph)();
      return F(
        node.arity,
        primitiveByGlyph(node.glyph) as (...args: Val[]) => Promise<Val>,
        node.glyph,
      );
    } else if (node.kind === "monadic modifier") {
      const arg = await this.visit(node.fn);
      const v = await primitiveByGlyph(node.glyph)(arg);
      if (v.kind === "function") v.repr = (await display(arg)) + node.glyph;
      return v;
    } else if (node.kind === "dyadic modifier") {
      const lft = await this.visit(node.fns[0]);
      const rgt = await this.visit(node.fns[1]);
      const v = await primitiveByGlyph(node.glyph)(lft, rgt);
      if (v.kind === "function")
        v.repr = (await display(lft)) + node.glyph + `(${await display(rgt)})`;
      return v;
    } else if (node.kind === "expression") {
      let i = node.values.length;
      const tines: Val[] = [];
      const get = async () => {
        const v = await this.visit(node.values[--i]);
        return tines.unshift(v), v;
      };
      const l = await get();
      if (i === 0) return l;
      let rgt: Fun;
      if (l.kind === "function" && l.arity === 2) {
        const m = await get();
        if (m.kind === "function" && m.arity === 2) {
          if (i === 0) {
            rgt = F(2, async (x, y) => l.data(await m.data(x, y), y));
          } else {
            const lft = await get();
            const lf =
              lft.kind === "function"
                ? lft.arity === 1
                  ? (_: Val, y: Val) => lft.data(y)
                  : lft.data
                : async () => lft;
            const r = l.data;
            rgt = F(2, (x, y) =>
              r(x, y).then(async (r) => m.data(await lf(x, y), r)),
            );
          }
        } else {
          const fn = m.kind === "function" ? m.data : async () => m;
          rgt = F(1, async (v) => l.data(await fn(m), v));
        }
      } else {
        rgt = l.kind === "function" ? l : nilad(l);
      }
      while (i > 0) {
        const rfn = rgt.data;
        const cur = await get();
        if (cur.kind !== "function" || cur.arity === 0)
          throw new Error("Unexpected nilad");
        if (cur.arity === 1) {
          rgt = F(rgt.arity, (...v) => rfn(...v).then(cur.data));
        } else if (i > 0) {
          const lft = await get();
          const arity = Math.max(
            rgt.arity,
            lft.kind === "function" ? lft.arity : 0,
          );
          const l =
            lft.kind === "function"
              ? lft.arity === 1 && arity === 2
                ? (_: Val, y: Val) => lft.data(y)
                : lft.data
              : async () => lft;
          const r =
            arity === 2 && rgt.arity === 1 ? (_: Val, y: Val) => rfn(y) : rfn;
          rgt = F(arity, (...v) =>
            r(...v).then(async (r) => cur.data(await l(...v), r)),
          );
        } else {
          const arity = Math.max(rgt.arity, 1);
          if (arity === 1) rgt = F(1, async (v) => cur.data(v, await rfn(v)));
          else rgt = F(2, async (x, y) => cur.data(y, await rfn(x, y)));
        }
      }
      rgt.repr = `(${(await asyncMap(tines, display)).join(" ")})`;
      return rgt;
    } else if (node.kind === "strand" || node.kind === "list") {
      const o: Val[] = [];
      for (let i = node.values.length - 1; i >= 0; i--)
        o.unshift(await execnilad(await this.visit(node.values[i])));
      return list(o);
    } else if (node.kind === "array") {
      if (node.values.length === 0) {
        throw new Error("Square brackets may not be empty");
      }
      const v: Val[] = [];
      for (let i = node.values.length - 1; i >= 0; i--)
        v.unshift(await execnilad(await this.visit(node.values[i])));
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
      } else {
        if (this.bindings.has(node.name)) return this.bindings.get(node.name)!;
        const scopes = [...this.scopes];
        return F(
          0,
          async () => {
            for (const s of scopes)
              if (s.has(node.name)) return s.get(node.name)!;
            throw new Error(`Unrecognized identifier '${node.name}'`);
          },
          node.name,
        );
      }
    } else if (node.kind === "binding") {
      const { name, declaredArity, value } = node;
      this.thisBinding = [name, declaredArity];
      this.scopes.unshift(newScope());
      const v = await execnilad(await this.visit(value));
      this.scopes.shift();
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
    } else if (node.kind === "assignment") {
      const { left } = node;
      if (left.kind === "namespace access") {
        const from = await execnilad(await this.visit(left.left));
        if (from.kind !== "namespace")
          throw new Error(
            "Left side of namespace assignment must be a namespace",
          );
        return F(
          1,
          async (v) => (from.data.set(left.name, v), v),
          `${await display(from)}.${left.name}${glyphs["::"].glyph}`,
        );
      } else if (left.kind === "reference") {
        const sc = this.scopes[0];
        return F(
          1,
          async (v) => (sc.set(left.name, v), v),
          left.name + glyphs["::"].glyph,
        );
      } else
        throw new Error(
          "Left side of assignment must be a reference or namespace access",
        );
    } else if (node.kind === "dfn") {
      function getArity(node: AstNode): number {
        if (node.kind === "dfn arg") return node.left ? 2 : 1;
        if (
          node.kind === "expression" ||
          node.kind === "array" ||
          node.kind === "list" ||
          node.kind === "strand"
        )
          return node.values.reduce((x, y) => Math.max(x, getArity(y)), 0);
        if (node.kind === "dyadic modifier")
          return Math.max(...node.fns.map(getArity));
        if (node.kind === "monadic modifier") return getArity(node.fn);
        if (node.kind === "namespace access" || node.kind === "assignment")
          return getArity(node.left);
        return 0;
      }
      const arity = getArity(node.def);
      if (arity === 0) {
        this.scopes.unshift(newScope());
        const e = await execnilad(await this.visit(node.def));
        this.scopes.shift();
        return e;
      }
      return F(
        arity,
        async (...v) => {
          const temp = this.dfns?.slice();
          this.dfns = arity === 1 ? [N(0), v[0]] : v;
          this.scopes.unshift(newScope());
          const e = await execnilad(await this.visit(node.def));
          this.scopes.shift();
          this.dfns = temp;
          return e;
        },
        `{${arity === 1 ? "monad" : "dyad"}}`,
      );
    } else if (node.kind === "dfn arg") {
      if (!this.dfns)
        throw new Error("Cannot reference dfn argument outside dfn");
      const v = node.left ? this.dfns[0] : this.dfns[1];
      return F(0, async () => v);
    } else if (node.kind === "scope reference") {
      return {
        kind: "namespace",
        data: this.scopes[Math.min(node.level, this.scopes.length - 1)],
      };
    } else if (node.kind === "namespace access") {
      let from = await execnilad(await this.visit(node.left));
      if (from.kind === "namespace") from = nilad(from);
      if (from.kind === "function")
        return F(
          from.arity,
          async (...v) => {
            const ns = await from.data(...v);
            if (ns.kind !== "namespace")
              throw new Error(
                "Namespace access function must return a namespace",
              );
            const p = ns.data.get(node.name);
            if (!p)
              throw new Error(
                `Property '${node.name}' does not exist in namespace`,
              );
            return p;
          },
          `${await display(from)}.${node.name}`,
        );
      throw new Error(
        "Left side of namespace access must be a namespace or a function",
      );
    }

    throw new Error(
      "could not handle node — this is an interpreter bug!\n" +
        JSON.stringify(node, null, 2),
    );
  }
}
