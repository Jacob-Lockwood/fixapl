import { glyphs } from "./glyphs";
export type Val =
  | { kind: "character"; data: number }
  | { kind: "number"; data: number }
  | { kind: "array"; shape: number[]; data: Val[] }
  | { kind: "function"; arity: number; data: (...x: Val[]) => Val };

export const F = (arity: number, data: (...v: Val[]) => Val) =>
  ({
    kind: "function",
    arity,
    data,
  }) satisfies Val;
export const N = (data: number): Val => ({ kind: "number", data });
export const C = (data: string): Val => ({
  kind: "character",
  data: data.codePointAt(0)!,
});
export const A = (shape: number[], data: Val[]) =>
  ({
    kind: "array",
    shape,
    data,
  }) satisfies Val;

export function display(val: Val): string {
  if (val.kind === "number")
    return val.data.toString().replace("-", glyphs.ng.glyph);
  if (val.kind === "character") {
    const j = JSON.stringify(String.fromCodePoint(val.data));
    return `'${j.slice(1, -1).replace(/'/g, "\\'")}'`;
  }
  if (val.kind === "function") return `<${val.arity === 1 ? "monad" : "dyad"}>`;
  if (val.shape.length === 0) {
    return glyphs.enc.glyph + display(val.data[0]);
  }
  if (val.shape.length === 1) {
    if (val.shape[0] !== 0 && val.data.every((v) => v.kind === "character")) {
      return JSON.stringify(
        String.fromCodePoint(...val.data.map((v) => v.data)),
      );
    }
    return `⟨${val.data.map(display).join(", ")}⟩`;
  }
  if (val.shape.includes(0)) return `[shape ${val.shape.join("×")}]`;
  const c = cells(val, -1).data;
  return `[${c.map(display).join(", ")}]`;
}

export function match(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function each(fn: (...x: Val[]) => Val, ...x: Val[]): Val {
  const [a, b] = x;
  if (a.kind === "array") {
    if (b?.kind === "array") {
      if (!match(a.shape, b.shape))
        throw new Error("Cannot iterate over arrays of different shape");
      const d = a.data.map((v, i) => fn(v, b.data[i]));
      return A(a.shape, d);
    }
    const d = a.data.map((v) => fn(v, b));
    return A(a.shape, d);
  }
  if (b?.kind === "array") {
    const d = b.data.map((v) => fn(a, v));
    return A(b.shape, d);
  }
  return fn(a, b);
}
export function cells(arr: Val, r: number) {
  if (arr.kind !== "array") return A([1], [arr]);
  if (r === 0) return arr;
  const frame = arr.shape.slice(0, -r);
  const cell = arr.shape.slice(-r);
  const delta = cell.reduce((a, b) => a * b, 1);
  const data: Val[] = [];
  for (let i = 0; i < arr.data.length; i += delta) {
    const chunk = arr.data.slice(i, i + delta);
    data.push(A(cell, chunk));
  }
  return A(frame, data);
}
export function atRank(ranks: number[], fn: (...x: Val[]) => Val) {
  return (...xs: Val[]) =>
    merge(each(fn, ...xs.map((x, i) => cells(x, ranks[i] ?? ranks[0]))));
}
function merge(y: Val) {
  if (y.kind !== "array") return y;
  const [sh, ...shs] = y.data.map(shape);
  if (!shs.every((v) => fMatch(v, sh).data))
    throw new Error("Cannot merge elements whose shapes do not match");
  const newsh = y.shape.concat(sh.data.map((x) => x.data as number));
  const dat = y.data.flatMap((x) => (x.kind === "array" ? x.data : x));
  return A(newsh, dat);
}
function mCells(y: Val) {
  if (y.kind !== "function")
    throw new Error("Operand to cells must be a function");
  return F(y.arity, atRank([-1], y.data));
}
function contents(y: Val) {
  if (y.kind !== "function")
    throw new Error("Operand to contents must be a function");
  return F(y.arity, (...v) => y.data(...v.map((x) => x && disclose(x))));
}
function disclose(y: Val) {
  return y.kind === "array" ? y.data[0] : y;
}
// function atDepth(
//   depths: number[],
//   fn: (...x: Val[]) => Val,
// ): (...xs: Val[]) => Val {
//   if (depths.every((n) => n === 0)) return fn;
//   return (...xs: Val[]) =>
//     each(
//       atDepth(
//         depths.map((n) => n && Math.min(n - 1, n + 1)),
//         fn,
//       ),
//       ...depths.map((d, i) => (d === 0 ? A([1], [xs[i]]) : xs[i])),
//     );
// }
export const range = (shape: number[]): Val =>
  A(
    shape,
    Array(shape.reduce((a, b) => a * b))
      .fill(0)
      .map((_, i) => N(i)),
  );
function iota(y: Val) {
  if (y.kind === "number") return range([y.data]);
  if (y.kind === "array") {
    if (y.shape.length === 1) {
      if (y.data.every((v) => v.kind === "number"))
        return range(y.data.map((v) => v.data));
      throw new Error("Cannot take range of non-numeric vector");
    }
    throw new Error("Cannot take range of non-vector array");
  }
  throw new Error(`Cannot take range of ${y.kind}`);
}
function add(x: Val, y: Val): Val {
  if (x.kind === "array" || y.kind === "array") return each(add, x, y);
  if (x.kind !== "number") {
    if (y.kind === "number") return add(y, x);
    throw new Error(`Cannot add ${x.kind} and ${y.kind}`);
  }
  if (y.kind === "function") throw new Error(`Cannot add number and function`);
  return { kind: y.kind, data: x.data + y.data };
}
function sub(x: Val, y: Val): Val {
  if (x.kind === "array" || y.kind === "array") return each(sub, x, y);
  if (x.kind === "character" && y.kind === "character")
    return N(x.data - y.data);
  if (y.kind !== "number")
    throw new Error(`Cannot subtract ${y.kind} from ${x.kind}`);
  if (x.kind === "function") throw new Error(`Cannot subtract a function`);
  return { kind: x.kind, data: x.data - y.data };
}
function mul(x: Val, y: Val): Val {
  if (x.kind === "array" || y.kind === "array") return each(mul, x, y);
  if (x.kind !== "number" || y.kind !== "number")
    throw new Error(`Cannot multiply ${x.kind} and ${y.kind}`);
  return N(x.data * y.data);
}
function mod(x: Val, y: Val): Val {
  if (x.kind === "array" || y.kind === "array") return each(mod, x, y);
  if (x.kind !== "number" || y.kind !== "number")
    throw new Error(`Cannot mod ${x.kind} and ${y.kind}`);
  return N(y.data >= 0 ? y.data % x.data : x.data + (y.data % x.data));
}
function abs(y: Val): Val {
  if (y.kind === "array") return each(abs, y);
  if (y.kind === "character")
    return C(String.fromCodePoint(y.data).toUpperCase());
  if (y.kind === "number") return N(Math.abs(y.data));
  throw new Error(`Cannot take absolute value of ${y.kind}`);
}
function sqr(y: Val): Val {
  if (y.kind === "array") return each(sqr, y);
  if (y.kind !== "number")
    throw new Error(`Cannot take square root of ${y.kind}`);
  return N(Math.sqrt(y.data));
}
function div(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array") return each(div, x, y);
  if (x.kind !== "number" || y.kind !== "number")
    throw new Error(`Cannot divide ${x.kind} and ${y.kind}`);
  return N(x.data / y.data);
}
function floor(x: Val) {
  if (x.kind === "array") return each(floor, x);
  if (x.kind !== "number") throw new Error(`Cannot take floor of ${x.kind}`);
  return N(Math.floor(x.data));
}
function round(x: Val) {
  if (x.kind === "array") return each(round, x);
  if (x.kind !== "number") throw new Error(`Cannot round ${x.kind}`);
  return N(Math.round(x.data));
}
function ceil(x: Val) {
  if (x.kind === "array") return each(ceil, x);
  if (x.kind !== "number") throw new Error(`Cannot take ceiling of ${x.kind}`);
  return N(Math.ceil(x.data));
}
function eq(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array") return each(eq, x, y);
  if (x.kind === "function" || y.kind === "function") return N(0);
  return N(x.kind === y.kind && x.data === y.data ? 1 : 0);
}
function not(y: Val) {
  if (y.kind === "array") return each(not, y);
  if (y.kind !== "number") throw new Error(`Cannot take NOT of ${y.kind}`);
  return N(1 - y.data);
}
function sign(y: Val) {
  if (y.kind === "array") return each(sign, y);
  if (y.kind === "number") return N(Math.sign(y.data));
  if (y.kind === "character") {
    const str = String.fromCodePoint(y.data);
    const up = str.toUpperCase();
    const lw = str.toLowerCase();
    return N(up === lw ? 0 : str === up ? 1 : -1);
  }
  throw new Error(`Cannot take sign of ${y.kind}`);
}
function ng(y: Val) {
  if (y.kind === "array") return each(ng, y);
  if (y.kind === "number") return sub(N(0), y);
  if (y.kind === "character") {
    const str = String.fromCodePoint(y.data);
    const up = str.toUpperCase();
    const lw = str.toLowerCase();
    return C(str === up ? lw : up);
  }
  throw new Error(`Cannot negate ${y.kind}`);
}
function ne(x: Val, y: Val) {
  return not(eq(x, y));
}
function grt(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array") return each(grt, y);
  if (x.kind !== y.kind)
    throw new Error(`Cannot compare ${x.kind} and ${y.kind}`);
  if (x.kind === "function" || y.kind === "function")
    throw new Error(`Cannot compare functions`);
  return N(x.data > y.data ? 1 : 0);
}
function gte(x: Val, y: Val) {
  return max(grt(x, y), eq(x, y));
}
function lte(x: Val, y: Val) {
  return not(gte(x, y));
}
function les(x: Val, y: Val) {
  return not(grt(x, y));
}
function max(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array") return each(grt, y);
  if (grt(x, y)) return x;
  return y;
}
function mEach(y: Val) {
  if (y.kind !== "function")
    throw new Error("Operand to each must be a function");
  return F(y.arity, (...x) => each(y.data, ...x));
}
function reduce(y: Val) {
  if (y.kind !== "function" || y.arity !== 2)
    throw new Error("Operand to reduce must be a dyadic function");
  return F(1, (x) => {
    if (x.kind !== "array") throw new Error(`Cannot reduce ${x.kind}`);
    const c = cells(x, -1);
    return c.data.reduce((acc, val) => y.data(acc, val));
  });
}
function scan(y: Val) {
  if (y.kind !== "function" || y.arity !== 2)
    throw new Error("Operand to scan must be a dyadic function");
  return F(1, (x) => {
    if (x.kind !== "array") throw new Error(`Cannot scan ${x.kind}`);
    const c = cells(x, -1);
    for (let i = 1, acc = c.data[0]; i < c.shape[0]; i++) {
      c.data[i] = acc = y.data(acc, c.data[i]);
    }
    return c;
  });
}
function fMatch(x: Val, y: Val): Val {
  if (x.kind !== y.kind) return N(0);
  if (x.kind !== "array") return N(x.data === y.data ? 1 : 0);
  if (y.kind !== "array") throw new Error("unreachable");
  if (!match(x.shape, y.shape)) return N(0);
  return N(x.data.every((v, i) => fMatch(v, y.data[i]).data) ? 1 : 0);
}
function noMatch(x: Val, y: Val) {
  return not(fMatch(x, y));
}
function backwards(y: Val) {
  if (y.kind !== "function")
    throw new Error("Operand to backwards must be a function");
  if (y.arity === 2) return F(2, (g, h) => y.data(h, g));
  throw new Error("Operand to backwards must be dyadic");
  // return y;
}
function self(y: Val) {
  if (y.kind !== "function")
    throw new Error("Operand to self must be a function");
  if (y.arity !== 2) throw new Error("Operand to self must be dyadic");
  return F(1, (v) => y.data(v, v));
}
function jot(x: Val, y: Val) {
  if (x.kind !== "function") {
    if (y.kind !== "function")
      throw new Error("Cannot compose two non-functions");
    return jot(backwards(y), x);
  }
  if (y.kind === "function") {
    if (x.arity === 1) return F(y.arity, (...v) => x.data(y.data(...v)));
    return F(y.arity, (g, h) => x.data(g, y.data(g, h)));
  }
  if (x.arity === 1) return x.data(y);
  return F(1, (g) => x.data(g, y));
}
function length(y: Val) {
  return N(y.kind === "array" ? (y.shape[0] ?? 0) : 0);
}
function shape(y: Val) {
  if (y.kind !== "array") return A([0], []);
  return A([y.shape.length], y.shape.map(N));
}
function cat(x: Val, y: Val): Val {
  if (x.kind === "array" && y.kind === "array") {
    const [xsh, ysh] = [x, y].map((v) => v.shape);
    if (xsh.length === ysh.length + 1) return cat(x, A([1, ...ysh], y.data));
    if (xsh.length + 1 === ysh.length) return cat(A([1, ...xsh], x.data), y);
    if (xsh.length !== ysh.length || !match(xsh.slice(1), ysh.slice(1)))
      throw new Error("Arguments to catenate must have matching cells");
    return A([xsh[0] + ysh[0], ...xsh.slice(1)], x.data.concat(y.data));
  } else if (x.kind === "array") {
    const sh = [1, ...x.shape.slice(1)];
    const d = Array(sh.reduce((a, b) => a * b))
      .fill(0)
      .map((_) => y);
    return cat(x, A(sh, d));
  } else if (y.kind === "array") {
    const sh = [1, ...y.shape.slice(1)];
    const d = Array(sh.reduce((a, b) => a * b))
      .fill(0)
      .map((_) => x);
    return cat(A(sh, d), y);
  } else {
    return A([2], [x, y]);
  }
}
function pair(x: Val, y: Val) {
  return A([2], [x, y]);
}
function reshape(x: Val, y: Val) {
  const sh: number[] = [];
  if (x.kind === "number" && x.data >= 0 && Number.isInteger(x.data)) {
    sh[0] = x.data;
  } else if (
    x.kind === "array" &&
    x.shape.length === 1 &&
    x.data.every(
      (v) => v.kind === "number" && v.data >= 0 && Number.isInteger(v.data),
    )
  ) {
    sh.push(...x.data.map((v) => v.data as number));
  } else throw new Error("Left argument to reshape must be a valid shape");
  const data = y.kind === "array" ? y.data : [y];
  if (data.length === 0) throw new Error("Cannot reshape empty array");
  const len = sh.reduce((x, y) => x * y, 1);
  const o = [];
  for (let i = 0; i < len; i++) {
    o.push(data[i % data.length]);
  }
  return A(sh, o);
}
function flat(y: Val) {
  if (y.kind !== "array") return y;
  return A([y.shape.reduce((x, y) => x * y, 1)], y.data);
}
function select(x: Val, y: Val) {
  if (y.kind !== "array") throw new Error("Cannot select from non-array");
  const c = cells(y, -1);
  const len = y.shape[0];
  return each((v) => {
    if (v.kind !== "number") throw new Error("Cannot select non-number");
    let i = v.data;
    if (i < 0) i += len;
    if (i > len) throw new Error(`Index ${i} out of bounds for length ${len}`);
    return c.data[i];
  }, x);
}
function pick(x: Val, y: Val): Val {
  if (y.kind !== "array") throw new Error("Cannot pick from non-array");
  if (x.kind === "number") return pick(A([1], [x]), y);
  else if (x.kind === "array") {
    if (x.shape.length === 1 && x.data.every((v) => v.kind === "number")) {
      const idx = x.data.map((v) => v.data);
      if (idx.length !== y.shape.length)
        throw new Error("Index must have same length as source's rank");
      const d = idx.reduce((tot, ax, i) => {
        const yax = y.shape[i];
        if (ax > yax)
          throw new Error(`Index ${ax} out of bounds for length ${yax}`);
        if (ax < 0) ax += yax;
        return tot * yax + ax;
      });
      return y.data[d];
    }
    return each((i) => pick(i, y), x);
  } else throw new Error("Invalid indices to pick");
}
function enclose(y: Val) {
  return A([], [y]);
}
function enlist(y: Val) {
  return A([1], [y]);
}
function transpose(y: Val) {
  if (y.kind !== "array") return y;
  // const o = y.data.map()
}

function over(x: Val, y: Val) {
  if (x.kind !== "function" || y.kind !== "function")
    throw new Error("Operands to over must both be functions");
  if (x.arity !== 2) throw new Error("Left operand to over must be dyadic");
  return F(2, (n, m) =>
    y.arity === 1
      ? x.data(y.data(n), y.data(m))
      : x.data(y.data(m, n), y.data(n, m)),
  );
}

type PrimitiveName = keyof {
  [K in keyof typeof glyphs as (typeof glyphs)[K]["kind"] extends "syntax"
    ? never
    : K]: 1;
};

export const primitives: Record<PrimitiveName, (...v: Val[]) => Val> = {
  eq,
  ne,
  grt,
  gte,
  les,
  lte,
  lft: (x, _) => x,
  rgt: (_, y) => y,
  id: (x) => x,
  iot: iota,
  add,
  sub,
  mul,
  div,
  mod,
  flo: floor,
  rou: round,
  cei: ceil,
  sig: sign,
  abs,
  sqr,
  mat: fMatch,
  nmt: noMatch,
  len: length,
  sha: shape,
  fla: flat,
  enc: enclose,
  enl: enlist,
  par: pair,
  cat,
  res: reshape,
  sel: select,
  pic: pick,
  bac: backwards,
  slf: self,
  eac: mEach,
  red: reduce,
  cel: mCells,
  mer: merge,
  con: contents,
  sca: scan,
  ov: over,
  jot,
  ng,
};
export function primitiveByGlyph(glyph: string) {
  return primitives[
    Object.entries(glyphs).find(
      ([_, data]) => data.glyph === glyph,
    )![0] as PrimitiveName
  ];
}
