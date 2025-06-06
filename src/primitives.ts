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

function map(fn: (...v: Val[]) => Val, ...arrs: (Val & { kind: "array" })[]) {
  const shape = arrs[0].shape;
  const d = arrs[0].data.map((v, i) => fn(v, arrs[1]?.data[i]));
  return A(shape, d);
}
function each(fn: (...x: Val[]) => Val, ...v: Val[]): Val {
  const [x, y] = v;
  if (x.kind === "array") {
    if (y?.kind === "array") {
      const [sx, sy] = [x.shape, y.shape];
      if (match(sx, sy)) return map(fn, x, y);
      const m = Math.min(sx.length, sy.length);
      if (!match(sx.slice(0, m), sy.slice(0, m)))
        throw new Error("Cannot iterate over arrays with different frames");
      if (m === sx.length) {
        const cy = cells(y, -m);
        const d = cy.data.map((v, i) => fn(x.data[i] ?? x.data[0], v));
        return A(cy.shape, d);
      } else {
        const cx = cells(x, -m);
        const d = cx.data.map((v, i) => fn(v, y.data[i] ?? y.data[0]));
        return A(cx.shape, d);
      }
    }
    const d = x.data.map((v) => fn(v, y));
    return A(x.shape, d);
  } else if (y?.kind === "array") {
    const d = y.data.map((v) => fn(x, v));
    return A(y.shape, d);
  } else return fn(x, y);
}
export function cells(arr: Val, r: number) {
  if (arr.kind !== "array") return A([1], [arr]);
  if (r === 0) return arr;
  const frame = arr.shape.slice(0, -r);
  const cell = arr.shape.slice(-r);
  if (cell.length === 0) return arr;
  const delta = cell.reduce((a, b) => a * b, 1);
  const data: Val[] = [];
  for (let i = 0; i < arr.data.length; i += delta) {
    const chunk = arr.data.slice(i, i + delta);
    data.push(A(cell, chunk));
  }
  return A(frame, data);
}
function rank(x: Val, y: Val) {
  if (x.kind !== "function")
    throw new Error("Left operand to rank must be function");
  if (y.kind === "number") y = A([1], [y]);
  if (
    y.kind !== "array" ||
    y.shape.length !== 1 ||
    y.shape[0] === 0 ||
    !y.data.every((v) => v.kind === "number" && Number.isInteger(v.data))
  )
    throw new Error("Rank must be an integer or non-empty integer vector");
  const r = y.data.map((v) => v.data as number);
  return F(x.arity, (...xs: Val[]) =>
    p.mer(each(x.data, ...xs.map((x, i) => cells(x, r[i] ?? r[0])))),
  );
}
function recur(fn: (g: (...xs: Val[]) => Val, ...xs: Val[]) => Val) {
  return function g(...xs: Val[]) {
    return fn(g, ...xs);
  };
}
function pervasive(fn: (...xs: Exclude<Val, { kind: "array" }>[]) => Val) {
  return recur((g, ...xs) =>
    xs.every((v) => v?.kind !== "array") ? fn(...xs) : each(g, ...xs),
  );
}
function disclose(y: Val) {
  return y.kind === "array" ? y.data[0] : y;
}
export const range = (shape: number[]): Val =>
  A(
    shape,
    Array(shape.reduce((a, b) => a * b))
      .fill(0)
      .map((_, i) => N(i)),
  );
function shape(y: Val) {
  if (y.kind !== "array") return A([0], []);
  return A([y.shape.length], y.shape.map(N));
}

function compare(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array")
    throw new Error("Cannot compare arrays");
  return p.grt(x, y).data ? 1 : p.eq(x, y).data ? 0 : -1;
}

type PrimitiveName = keyof {
  [K in keyof typeof glyphs as (typeof glyphs)[K]["kind"] extends "syntax"
    ? never
    : K]: 1;
};
const p: Record<PrimitiveName, (...v: Val[]) => Val> = {
  eq: pervasive((x, y) => {
    if (x.kind === "function" || y.kind === "function") return N(0);
    return N(x.kind === y.kind && x.data === y.data ? 1 : 0);
  }),
  ne: (x, y) => p.not(p.eq(x, y)),
  grt: pervasive((x: Val, y: Val) => {
    if (x.kind === "function" || y.kind === "function")
      throw new Error(`Cannot compare functions`);
    if (x.kind === y.kind) return N(x.data > y.data ? 1 : 0);
    return N(x.kind === "character" ? 1 : 0);
  }),
  gte: (x, y) => p.max(p.grt(x, y), p.eq(x, y)),
  les: (x, y) => p.not(p.gte(x, y)),
  lte: (x, y) => p.not(p.grt(x, y)),
  not: pervasive((y) => {
    if (y.kind === "number") return N(1 - y.data);
    throw new Error(`Cannot take NOT ${y.kind}`);
  }),
  ng: pervasive((y) => {
    if (y.kind === "number") return p.sub(N(0), y);
    if (y.kind === "character") {
      const str = String.fromCodePoint(y.data);
      const up = str.toUpperCase();
      const lw = str.toLowerCase();
      return C(str === up ? lw : up);
    }
    throw new Error(`Cannot negate ${y.kind}`);
  }),
  sig: pervasive((y) => {
    if (y.kind === "number") return N(Math.sign(y.data));
    if (y.kind === "character") {
      const str = String.fromCodePoint(y.data);
      const up = str.toUpperCase();
      const lw = str.toLowerCase();
      return N(up === lw ? 0 : str === up ? 1 : -1);
    }
    throw new Error(`Cannot take sign of ${y.kind}`);
  }),
  abs: pervasive((y) => {
    if (y.kind === "character")
      return C(String.fromCodePoint(y.data).toUpperCase());
    if (y.kind === "number") return N(Math.abs(y.data));
    throw new Error(`Cannot take absolute value of ${y.kind}`);
  }),
  sqr: pervasive((y) => {
    if (y.kind === "number") return N(Math.sqrt(y.data));
    throw new Error(`Cannot take absolute value of ${y.kind}`);
  }),
  flo: pervasive((y) => {
    if (y.kind === "number") return N(Math.floor(y.data));
    throw new Error(`Cannot take floor of ${y.kind}`);
  }),
  rou: pervasive((y) => {
    if (y.kind === "number") return N(Math.round(y.data));
    throw new Error(`Cannot round ${y.kind}`);
  }),
  cei: pervasive((y) => {
    if (y.kind === "number") return N(Math.ceil(y.data));
    throw new Error(`Cannot take ceil of ${y.kind}`);
  }),
  rol: pervasive((y) => {
    if (y.kind !== "number" || !Number.isInteger(y.data) || y.data < 0)
      throw new Error("Argument to roll must be a nonnegative integer array");
    return N(y.data === 0 ? Math.random() : Math.floor(Math.random() * y.data));
  }),
  add: pervasive((x, y) => {
    if (x.kind === "function" || y.kind === "function")
      throw new Error("Cannot add functions");
    if (x.kind === "character" && y.kind === "character")
      throw new Error("Cannot add two characters");
    const kind = x.kind === "character" ? x.kind : y.kind;
    return { kind, data: x.data + y.data };
  }),
  sub: pervasive((x, y) => {
    if (x.kind === "character" && y.kind === "character")
      return N(x.data - y.data);
    if (y.kind !== "number")
      throw new Error(`Cannot subtract ${y.kind} from ${x.kind}`);
    if (x.kind === "function") throw new Error(`Cannot subtract a function`);
    return { kind: x.kind, data: x.data - y.data };
  }),
  mul: pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw new Error(`Cannot multiply ${x.kind} and ${y.kind}`);
    return N(x.data * y.data);
  }),
  div: pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw new Error(`Cannot divide ${x.kind} and ${y.kind}`);
    return N(x.data * y.data);
  }),
  mod: pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw new Error(`Cannot mod ${x.kind} and ${y.kind}`);
    return N(y.data >= 0 ? y.data % x.data : x.data + (y.data % x.data));
  }),
  pow: pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw new Error(`Cannot power ${x.kind} and ${y.kind}`);
    return N(x.data ** y.data);
  }),
  log: pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw new Error(`Cannot log ${x.kind} and ${y.kind}`);
    return N(Math.log(y.data) / Math.log(x.data));
  }),
  max: pervasive((x: Val, y: Val) => {
    if (p.grt(x, y)) return x;
    return y;
  }),
  min: pervasive((x: Val, y: Val) => {
    if (p.grt(x, y)) return y;
    return x;
  }),
  rev: (y) => (y.kind === "array" ? A(y.shape, [...y.data].reverse()) : y),
  tra: (y) => {
    if (y.kind !== "array" || y.shape.length === 0) return y;
    const sh = y.shape.slice(1);
    sh.push(y.shape[0]);
    const o = y.data.map((_, i, a) => {
      const idx = [...sh]
        .reverse()
        .map((ax) => {
          const j = i % ax;
          i = Math.floor(i / ax);
          return j;
        })
        .reverse();
      idx.unshift(idx.pop()!);
      const d = idx.reduce((tot, ax, i) => tot * y.shape[i] + ax, 0);
      return a[d];
    });
    return A(sh, o);
  },
  iot: (y) => {
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
  },
  len: (y) => N(y.kind === "array" ? (y.shape[0] ?? 0) : 0),
  sha: shape,
  fla: (y) =>
    y.kind === "array" ? A([y.shape.reduce((x, y) => x * y, 1)], y.data) : y,
  enc: (y) => A([], [y]),
  enl: (y) => A([1], [y]),
  mer: (y) => {
    if (y.kind !== "array") return y;
    const [sh, ...shs] = y.data.map(shape);
    if (!shs.every((v) => p.mat(v, sh).data))
      throw new Error("Cannot merge elements whose shapes do not match");
    const newsh = y.shape.concat(sh.data.map((x) => x.data as number));
    const dat = y.data.flatMap((x) => (x.kind === "array" ? x.data : x));
    return A(newsh, dat);
  },
  gru: (y) => {
    if (y.kind !== "array" || y.shape.length < 1)
      throw new Error("Grade argument must have at least rank 1");
    const { shape, data: d } = cells(y, -1);
    const s = d.map((_, i) => i).sort((a, b) => compare(d[a], d[b]));
    return A(shape, s.map(N));
  },
  grd: (y) => {
    if (y.kind !== "array" || y.shape.length < 1)
      throw new Error("Grade argument must have at least rank 1");
    const { shape, data: d } = cells(y, -1);
    const s = d.map((_, i) => i).sort((a, b) => -compare(d[a], d[b]));
    return A(shape, s.map(N));
  },
  sru: (y) => p.sel(p.gru(y), y),
  srd: (y) => p.sel(p.grd(y), y),
  mat: recur((mat, x, y) => {
    if (x.kind !== y.kind) return N(0);
    if (x.kind !== "array") return N(x.data === y.data ? 1 : 0);
    if (y.kind !== "array") throw new Error("unreachable");
    if (!match(x.shape, y.shape)) return N(0);
    return N(x.data.every((v, i) => mat(v, y.data[i]).data) ? 1 : 0);
  }),
  nmt: (x, y) => p.not(p.mat(x, y)),
  par: (x, y) => A([2], [x, y]),
  cat: recur((cat, x, y) => {
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
  }),
  res: (x, y) => {
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
  },
  rpl: (x, y) => {
    if (y.kind !== "array") throw new Error("Cannot replicate non-array");
    const cel = cells(y, -1);
    const isOk = (v: Val) =>
      v.kind === "number" && v.data >= 0 && Number.isInteger(v.data);
    if (
      !isOk(x) &&
      (x.kind !== "array" || (x.shape.length !== 1 && !x.data.every(isOk)))
    )
      throw new Error("Invalid replicate amount");
    const amounts = (x.kind === "array" ? x.data : [x]).map(
      (v) => v.data as number,
    );
    if (amounts.length > cel.shape[0])
      throw new Error("Replicate amount may not be longer than array");
    return A(
      cel.shape,
      cel.data.flatMap((x, i) => Array(amounts[i % amounts.length]).fill(x)),
    );
  },
  sel: (x, y) => {
    if (y.kind !== "array") throw new Error("Cannot select from non-array");
    const c = cells(y, -1);
    const len = y.shape[0];
    return each((v) => {
      if (v.kind !== "number") throw new Error("Cannot select non-number");
      let i = v.data;
      if (i < 0) i += len;
      if (i >= len || i < 0)
        throw new Error(`Index ${i} out of bounds for length ${len}`);
      return c.data[i];
    }, x);
  },
  pic: recur((pick, x, y) => {
    if (y.kind !== "array") throw new Error("Cannot pick from non-array");
    if (x.kind === "number") return pick(A([1], [x]), y);
    else if (x.kind === "array") {
      if (x.shape.length === 1 && x.data.every((v) => v.kind === "number")) {
        const idx = x.data.map((v) => v.data);
        if (idx.length !== y.shape.length)
          throw new Error("Index must have same length as source's rank");
        const d = idx.reduce((tot, ax, i) => {
          const yax = y.shape[i];
          if (ax < 0) ax += yax;
          if (ax >= yax || ax < 0)
            throw new Error(`Index ${ax} out of bounds for length ${yax}`);
          return tot * yax + ax;
        }, 0);
        return y.data[d];
      }
      return each((i) => pick(i, y), x);
    } else throw new Error("Invalid indices to pick");
  }),
  tak: recur((take, x, y) => {
    if (y.kind !== "array") throw new Error("Cannot take from non-array");
    if (x.kind === "number") {
      const cel = cells(y, -1);
      const len = y.shape[0];
      if (x.data > len || x.data < -len)
        throw new Error(`Take amount outside of bounds for length ${len}`);
      const d = x.data < 0 ? cel.data.slice(x.data) : cel.data.slice(0, x.data);
      return A(
        [d.length, ...y.shape.slice(1)],
        d.flatMap((x) => (x.kind === "array" ? x.data : x)),
      );
    } else if (x.kind === "array" && x.data.every((v) => v.kind === "number")) {
      const arr = take(x.data[0], y);
      if (x.data.length === 1) return arr;
      return map(
        (z) => take(A([x.shape[0] - 1], x.data.slice(1)), z),
        cells(arr, -1),
      );
    } else throw new Error("Invalid take amount");
  }),
  dro: recur((drop, x, y) => {
    if (y.kind !== "array") throw new Error("Cannot drop from non-array");
    if (x.kind === "number") {
      const cel = cells(y, -1);
      const len = y.shape[0];
      if (x.data > len || x.data < -len)
        throw new Error(`Take amount outside of bounds for length ${len}`);
      const d = x.data < 0 ? cel.data.slice(0, x.data) : cel.data.slice(x.data);
      return A(
        [d.length, ...y.shape.slice(1)],
        d.flatMap((x) => (x.kind === "array" ? x.data : x)),
      );
    } else if (x.kind === "array" && x.data.every((v) => v.kind === "number")) {
      const arr = drop(x.data[0], y);
      if (x.data.length === 1) return arr;
      return map(
        (z) => drop(A([x.shape[0] - 1], x.data.slice(1)), z),
        cells(arr, -1),
      );
    } else throw new Error("Invalid take amount");
  }),
  rot: recur((rot, x, y) => {
    if (y.kind !== "array") throw new Error("Cannot rotate non-array");
    if (x.kind === "number") {
      const cel = cells(y, -1);
      const len = y.shape[0];
      const rot = (x.data % len) + (x.data < 0 ? len : 0);
      const d = cel.data.slice(rot).concat(cel.data.slice(0, rot));
      return A(
        [d.length, ...y.shape.slice(1)],
        d.flatMap((x) => (x.kind === "array" ? x.data : x)),
      );
    } else if (x.kind === "array" && x.data.every((v) => v.kind === "number")) {
      const arr = rot(x.data[0], y);
      if (x.data.length === 1) return arr;
      return map(
        (z) => rot(A([x.shape[0] - 1], x.data.slice(1)), z),
        cells(arr, -1),
      );
    } else throw new Error("Invalid take amount");
  }),
  slf: (y) => F(1, y.kind === "function" ? (v) => y.data(v, v) : (_) => y),
  bac: (y) => F(2, y.kind === "function" ? (g, h) => y.data(h, g) : (_) => y),
  cel: (y) => rank(y, N(-1)),
  con: (y) => {
    if (y.kind !== "function")
      throw new Error("Operand to contents must be a function");
    return F(y.arity, (...v) => y.data(...v.map((x) => x && disclose(x))));
  },
  eac: (y) => {
    if (y.kind !== "function")
      throw new Error("Operand to each must be a function");
    return F(y.arity, (...x) => each(y.data, ...x));
  },
  red: (y) => {
    if (y.kind !== "function" || y.arity !== 2)
      throw new Error("Operand to reduce must be a dyadic function");
    return F(1, (x) => {
      if (x.kind !== "array") return x;
      if (x.data.length === 0) throw new Error("Cannot reduce empty array");
      const c = cells(x, -1);
      return c.data.reduce((acc, val) => y.data(acc, val));
    });
  },
  sca: (y) => {
    if (y.kind !== "function" || y.arity !== 2)
      throw new Error("Operand to scan must be a dyadic function");
    return F(1, (x) => {
      if (x.kind !== "array") throw new Error(`Cannot scan ${x.kind}`);
      const c = cells(x, -1);
      const o = [];
      for (let i = 1, acc = c.data[0]; i < c.shape[0]; i++) {
        o.push((acc = y.data(acc, c.data[i])));
      }
      return A(c.shape, o);
    });
  },
  fol: (y) => {
    if (y.kind !== "function" || y.arity !== 2)
      throw new Error("Operand to fold must be a dyadic function");
    return F(2, (v, w) => {
      if (w.kind !== "array") throw new Error(`Cannot reduce ${w.kind}`);
      const c = cells(w, -1);
      return c.data.reduce((acc, val) => y.data(acc, val), v);
    });
  },
  tab: (y) => {
    if (y.kind !== "function" || y.arity !== 2)
      throw new Error("Operand to table must be a dyadic function");
    return F(2, (v, w) => {
      const sv = v.kind === "array" ? v.shape.slice(0, 1) : [];
      const sw = w.kind === "array" ? w.shape.slice(0, 1) : [];
      const shape = sv.concat(sw);
      const cv = cells(v, -1);
      const cw = cells(w, -1);
      const o = [];
      for (const h of cv.data) for (const g of cw.data) o.push(y.data(h, g));
      return A(shape, o);
    });
  },
  rep: (y) => {
    if (y.kind !== "function")
      throw new Error("Operand to repeat must be a function");
    const fn = y.arity === 2 ? y.data : (_: Val, v: Val) => y.data(v);
    return F(2, (w, x) => {
      if (w.kind !== "number" || !(Number.isInteger(w.data) && w.data >= 0))
        throw new Error("Repetition count must be a nonnegative integer");
      let cur: Val = x;
      for (let i = 0; i < w.data; i++) {
        cur = fn(N(i), cur);
      }
      return cur;
    });
  },
  unt: (x, y) => {
    if (x.kind !== "function" || (y.kind !== "function" && y.kind !== "number"))
      throw new Error("Invalid operand types to until");
    const iter = x.arity === 2 ? x.data : (_: Val, v: Val) => x.data(v);
    const cond = y.kind === "function" ? y : F(1, () => y);
    const end = (...v: Val[]) => {
      const r = cond.data(...v);
      if (r.kind !== "number" && (r.data === 0 || r.data === 1))
        throw new Error("Condition function must return a boolean");
      return r.data;
    };
    const maxIter = 10000;
    if (cond.arity === 1)
      return F(x.arity, (v, w) => {
        let g = x.arity === 1 ? v : w;
        for (let i = 0; !end(g); i++) {
          if (i > maxIter)
            throw new Error(
              `Maximum iteration count reached; last value ${display(g)}`,
            );
          g = iter(v, g);
        }
        return g;
      });
    return F(x.arity, (v, w) => {
      let g = x.arity === 1 ? v : w;
      let h: Val;
      let i = 0;
      for (; i < maxIter; i++) {
        h = iter(v, g);
        if (end(g, h)) return h;
        i++;
        g = iter(v, h);
        if (end(h, g)) return g;
      }
      throw new Error(
        `Maximum iteration count reached; last value ${display(g)}`,
      );
    });
  },
  und: (x, y) => {
    if (x.kind !== "function" || y.kind !== "function")
      throw new Error("Operands to under must both be functions");
    const arity = Math.max(x.arity, y.arity);
    return F(arity, (...v) => {
      const arr = v[arity - 1];
      if (arr.kind !== "array")
        throw new Error("Under argument must be an array");
      const indices = p.iot(p.sha(arr));
      const [t, ti] = [arr, indices].map((z) =>
        y.arity === 1 ? y.data(z) : y.data(v[0], z),
      );
      const isOk = (x: Val) =>
        x.kind === "number" &&
        x.data >= 0 &&
        x.data < arr.data.length &&
        Number.isInteger(x.data);
      if (isOk(ti)) {
        const i = ti.data as number;
        const z = x.data(t);
        return A(
          arr.shape,
          arr.data.map((v, x) => (i === x ? z : v)),
        );
      } else if (ti.kind === "array") {
        if (
          t.kind !== "array" ||
          !match(ti.shape, t.shape) ||
          !ti.data.every(isOk) ||
          new Set(ti.data.map((x) => x.data)).size !== ti.data.length
        )
          throw new Error("Invalid transformation");
        const dat = x.data(t);
        if (dat.kind !== "array" || !match(dat.shape, t.shape))
          throw new Error("Function cannot change shape");
        return each((v) => {
          const i = v.data as number;
          const g = ti.data.findIndex((z) => z.data === i);
          if (g === -1) return arr.data[i];
          return dat.data[g];
        }, indices);
      } else {
        throw new Error(
          "Under transformation must return a number or number array",
        );
      }
    });
  },
  cho: (x, y) => {
    if (x.kind !== "array" || x.shape.length !== 1)
      throw new Error("Left operand to choose must be a list");
    if (y.kind !== "function")
      throw new Error("Right operand to choose must be a function");
    const fs = [y, ...x.data];
    const arity = Math.max(
      1,
      ...fs.map((v) => (v.kind === "function" ? v.arity : 0)),
    );
    const [cond, ...cfs] = fs.map((v) =>
      v.kind === "function"
        ? arity === 2 && v.arity !== 2
          ? (_: Val, z: Val) => v.data(z)
          : v.data
        : () => v,
    );
    return F(arity, (...v) => {
      const idx = cond(...v);
      if (
        idx.kind !== "number" ||
        !Number.isInteger(idx.data) ||
        idx.data < 0 ||
        idx.data >= cfs.length
      )
        throw new Error("Invalid choose index");
      return cfs[idx.data](...v);
    });
  },
  // ([x] F y) G y
  bef: (x, y) => {
    if (y.kind !== "function")
      throw new Error("Right operand to before must be a function");
    if (y.arity === 1) return p.aft(y, x);
    const l = x.kind === "function" ? x : F(1, () => x);
    return F(l.arity, (v, w) => y.data(l.data(v, w), l.arity === 1 ? v : w));
  },
  // [x] F ([x] G y)
  aft: (x, y) => {
    if (x.kind !== "function")
      throw new Error("Left operand to after must be a dyadic function");
    if (y.kind !== "function") {
      if (x.arity === 1) return x.data(y);
      return F(1, (v) => x.data(v, y));
    }
    if (x.arity === 1) return F(y.arity, (...v) => x.data(y.data(...v)));
    return F(2, (v, w) => x.data(v, y.arity === 1 ? y.data(w) : y.data(v, w)));
  },
  ov: (x, y) => {
    if (x.kind !== "function" || y.kind !== "function")
      throw new Error("Operands to over must both be functions");
    if (x.arity !== 2) throw new Error("Left operand to over must be dyadic");
    return F(2, (n, m) =>
      y.arity === 1
        ? x.data(y.data(n), y.data(m))
        : x.data(y.data(m, n), y.data(n, m)),
    );
  },
  lft: (x, _) => x,
  rgt: (_, y) => y,
  id: (y) => y,
};
export const primitives = p;
export function primitiveByGlyph(glyph: string) {
  return primitives[
    Object.entries(glyphs).find(
      ([_, data]) => data.glyph === glyph,
    )![0] as PrimitiveName
  ];
}
