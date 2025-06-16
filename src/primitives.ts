import { match, range, A, F, C, N, type Val } from "./util";
import type { PrimitiveKind } from "./glyphs";

export function display(val: Val): string {
  if (val.kind === "number") return val.data.toString().replace("-", ng.glyph);
  if (val.kind === "character") {
    const j = JSON.stringify(String.fromCodePoint(val.data));
    return `'${j.slice(1, -1).replace(/'/g, "\\'")}'`;
  }
  if (val.kind === "function") return `<${val.arity === 1 ? "monad" : "dyad"}>`;
  if (val.shape.length === 0) {
    return enc.glyph + display(val.data[0]);
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

const fromCells = (arr: Val[]) => A([arr.length], arr);
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
function cells(arr: Val, r: number) {
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
  if (x.kind !== "function") throw new Error("X must be function");
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
    mer.def(each(x.data, ...xs.map((x, i) => cells(x, r[i] ?? r[0])))),
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
function shape(y: Val) {
  if (y.kind !== "array") return A([0], []);
  return A([y.shape.length], y.shape.map(N));
}

function compare(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array")
    throw new Error("Cannot compare arrays");
  return grt.def(x, y).data ? 1 : eq.def(x, y).data ? 0 : -1;
}

export type Entry = {
  kind: PrimitiveKind;
  glyph: string;
  name: string;
  def: (...v: Val[]) => Val;
};
export const order: string[] = [];
const metaEntry =
  (kind: PrimitiveKind, err: (glyph: string) => string) =>
  (
    glyph: string,
    name: string,
    fn: (err: (s: string) => Error) => (...xs: Val[]) => Val,
  ): Entry => {
    order.push(glyph);
    return {
      kind,
      glyph,
      name,
      def: fn((s) => new Error(err(glyph) + ": " + s)),
    };
  };
const df = metaEntry("dyadic function", (g) => `x${g}y`);
const mf = metaEntry("monadic function", (g) => `${g}y`);
const dm = metaEntry("dyadic modifier", (g) => `X${g}Y`);
const mm = metaEntry("monadic modifier", (g) => `X${g}`);

export const eq = df("=", "equal", () =>
  pervasive((x, y) => {
    if (x.kind === "function" || y.kind === "function") return N(0);
    return N(x.kind === y.kind && x.data === y.data ? 1 : 0);
  }),
);
export const ne = df("≠", "not equal", () => (x, y) => not.def(eq.def(x, y)));
export const grt = df(">", "greater than", (err) =>
  pervasive((x: Val, y: Val) => {
    if (x.kind === "function" || y.kind === "function")
      throw err("Cannot compare functions");
    if (x.kind === y.kind) return N(x.data > y.data ? 1 : 0);
    return N(x.kind === "character" ? 1 : 0);
  }),
);
export const gte = df("≥", "greater or equal", () => (x, y) => {
  return max.def(grt.def(x, y), eq.def(x, y));
});
export const les = df("<", "less than", () => (x, y) => not.def(gte.def(x, y)));
export const lte = df("≤", "less or equal", () => (x, y) => {
  return not.def(grt.def(x, y));
});

export const not = mf("¬", "not", () => (y) => sub.def(N(1), y));
export const ng = mf("¯", "negate", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return sub.def(N(0), y);
    if (y.kind === "character") {
      const str = String.fromCodePoint(y.data);
      const up = str.toUpperCase();
      const lw = str.toLowerCase();
      return C(str === up ? lw : up);
    }
    throw err(`y can only be numbers or characters`);
  }),
);
export const sig = mf("±", "sign", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return N(Math.sign(y.data));
    if (y.kind === "character") {
      const str = String.fromCodePoint(y.data);
      const up = str.toUpperCase();
      const lw = str.toLowerCase();
      return N(up === lw ? 0 : str === up ? 1 : -1);
    }
    throw err(`y can only be numbers or characters`);
  }),
);
export const abs = mf("⌵", "absolute value", (err) =>
  pervasive((y) => {
    if (y.kind === "character")
      return C(String.fromCodePoint(y.data).toUpperCase());
    if (y.kind === "number") return N(Math.abs(y.data));
    throw err(`y can only be numbers or characters`);
  }),
);
export const sqr = mf("√", "square root", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return N(Math.sqrt(y.data));
    throw err(`square root is only defined for numbers`);
  }),
);
export const flo = mf("⌊", "floor", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return N(Math.floor(y.data));
    throw err(`y must be numbers`);
  }),
);
export const rou = mf("⁅", "round", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return N(Math.round(y.data));
    throw err(`y must be numbers`);
  }),
);
export const cei = mf("⌈", "ceiling", (err) =>
  pervasive((y) => {
    if (y.kind === "number") return N(Math.ceil(y.data));
    throw err(`y must be numbers`);
  }),
);
export const rol = mf("?", "roll", (err) =>
  pervasive((y) => {
    if (y.kind !== "number" || !Number.isInteger(y.data) || y.data < 0)
      throw err("y must be nonnegative integers");
    return N(y.data === 0 ? Math.random() : Math.floor(Math.random() * y.data));
  }),
);

export const add = df("+", "add", (err) =>
  pervasive((x, y) => {
    if (x.kind === "function" || y.kind === "function")
      throw err("Cannot add functions");
    if (x.kind === "character" && y.kind === "character")
      throw err("Cannot add two characters");
    const kind = x.kind === "character" ? x.kind : y.kind;
    return { kind, data: x.data + y.data };
  }),
);
export const sub = df("-", "subtract", (err) =>
  pervasive((x, y) => {
    if (x.kind === "character" && y.kind === "character")
      return N(x.data - y.data);
    if (y.kind !== "number")
      throw err(`Cannot subtract ${y.kind} from ${x.kind}`);
    if (x.kind === "function") throw err(`Cannot subtract a function`);
    return { kind: x.kind, data: x.data - y.data };
  }),
);
export const mul = df("×", "multiply", (err) =>
  pervasive((x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data * y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const div = df("÷", "divide", (err) =>
  pervasive((x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data * y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const mod = df("|", "modulo", (err) =>
  pervasive((x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw err(`x and y must be numbers`);
    return N(y.data >= 0 ? y.data % x.data : x.data + (y.data % x.data));
  }),
);
export const pow = df("*", "power", (err) =>
  pervasive((x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data ** y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const log = df("⍟", "logarithm", (err) =>
  pervasive((x, y) => {
    if (x.kind === "number" && y.kind === "number")
      return N(Math.log(y.data) / Math.log(x.data));
    throw err(`x and y must be numbers`);
  }),
);
export const max = df("↥", "maximum", () =>
  pervasive((x, y) => (grt.def(x, y).data ? x : y)),
);
export const min = df("↧", "minimum", () =>
  pervasive((x, y) => (grt.def(y, x).data ? x : y)),
);

export const rev = mf("⋈", "reverse", () => (y) => {
  return y.kind === "array" ? A(y.shape, [...y.data].reverse()) : y;
});
export const tra = mf("⍉", "transpose", () => (y) => {
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
});
export const int = mf("⍳", "integers", (err) => (y) => {
  if (
    y.kind === "array" &&
    y.shape.length === 1 &&
    y.data.every(
      (v) => v.kind === "number" && Number.isInteger(v.data) && v.data >= 0,
    )
  )
    return range(y.data.map((v) => v.data as number));
  if (y.kind !== "number") throw err("invalid y");
  if (!Number.isInteger(y.data) || y.data < 0)
    throw err("y must be an integer");
  return range([y.data]);
});
export const len = mf("⧻", "length", () => (y) => {
  return N(y.kind === "array" ? (y.shape[0] ?? 0) : 0);
});
export const sha = mf("△", "shape", () => shape);
export const fla = mf(
  "▽",
  "flat",
  () => (y) =>
    y.kind === "array" ? A([y.shape.reduce((x, y) => x * y, 1)], y.data) : y,
);
export const enc = mf("□", "enclose", () => (y) => A([], [y]));
export const enl = mf("⋄", "enlist", () => (y) => A([1], [y]));
export const mer = mf("⊡", "merge", (err) => (y) => {
  if (y.kind !== "array") return y;
  const [sh, ...shs] = y.data.map(shape);
  if (!shs.every((v) => mat.def(v, sh).data))
    throw err("Cannot merge elements whose shapes do not match");
  const newsh = y.shape.concat(sh.data.map((x) => x.data as number));
  const dat = y.data.flatMap((x) => (x.kind === "array" ? x.data : x));
  return A(newsh, dat);
});
export const gru = mf("⍋", "grade up", (err) => (y) => {
  if (y.kind !== "array" || y.shape.length < 1)
    throw err("Grade argument must have at least rank 1");
  const { shape, data: d } = cells(y, -1);
  const s = d.map((_, i) => i).sort((a, b) => compare(d[a], d[b]));
  return A(shape, s.map(N));
});
export const grd = mf("⍒", "grade down", (err) => (y) => {
  if (y.kind !== "array" || y.shape.length < 1)
    throw err("Grade argument must have at least rank 1");
  const { shape, data: d } = cells(y, -1);
  const s = d.map((_, i) => i).sort((a, b) => -compare(d[a], d[b]));
  return A(shape, s.map(N));
});
export const sru = mf("⊴", "sort up", () => (y) => sel.def(gru.def(y), y));
export const srd = mf("⊵", "sort down", () => (y) => sel.def(grd.def(y), y));

export const mat = df("≡", "match", (err) =>
  recur((mat, x, y) => {
    if (x.kind !== y.kind) return N(0);
    if (x.kind !== "array") return N(x.data === y.data ? 1 : 0);
    if (y.kind !== "array") throw err("unreachable");
    if (!match(x.shape, y.shape)) return N(0);
    return N(x.data.every((v, i) => mat(v, y.data[i]).data) ? 1 : 0);
  }),
);
export const nmt = df("≢", "nomatch", () => (x, y) => not.def(mat.def(x, y)));
export const par = df("⍮", "pair", () => (x, y) => A([2], [x, y]));
export const cat = df("⍪", "catenate", (err) =>
  recur((cat, x, y) => {
    if (x.kind === "array" && y.kind === "array") {
      const [xsh, ysh] = [x, y].map((v) => v.shape);
      if (xsh.length === ysh.length + 1) return cat(x, A([1, ...ysh], y.data));
      if (xsh.length + 1 === ysh.length) return cat(A([1, ...xsh], x.data), y);
      if (xsh.length !== ysh.length || !match(xsh.slice(1), ysh.slice(1)))
        throw err("x and y must have matching cells");
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
);
export const res = df("⍴", "reshape", (err) => (x, y) => {
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
  } else throw err("x must be a valid shape");
  const data = y.kind === "array" ? y.data : [y];
  if (data.length === 0) throw err("Cannot reshape empty array");
  const len = sh.reduce((x, y) => x * y, 1);
  const o = [];
  for (let i = 0; i < len; i++) {
    o.push(data[i % data.length]);
  }
  return A(sh, o);
});
export const rpl = df("⌿", "replicate", (err) => (x, y) => {
  if (y.kind !== "array") throw err("y must be an array");
  const cel = cells(y, -1);
  const isOk = (v: Val) =>
    v.kind === "number" && v.data >= 0 && Number.isInteger(v.data);
  if (
    !isOk(x) &&
    (x.kind !== "array" || (x.shape.length !== 1 && !x.data.every(isOk)))
  )
    throw err("Invalid replicate amount");
  const amounts = (x.kind === "array" ? x.data : [x]).map(
    (v) => v.data as number,
  );
  if (amounts.length > cel.shape[0])
    throw err("Replicate amount may not be longer than array");
  return A(
    cel.shape,
    cel.data.flatMap((x, i) => Array(amounts[i % amounts.length]).fill(x)),
  );
});
export const sel = df("⊇", "select", (err) => (x, y) => {
  if (y.kind !== "array") throw err("y must be an array");
  const c = cells(y, -1);
  const len = y.shape[0];
  return each((v) => {
    if (v.kind !== "number") throw err("Cannot select non-number");
    let i = v.data;
    if (i < 0) i += len;
    if (i >= len || i < 0)
      throw err(`Index ${i} out of bounds for length ${len}`);
    return c.data[i];
  }, x);
});
export const pic = df("⊃", "pick", (err) =>
  recur((pick, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
    if (x.kind === "number") return pick(A([1], [x]), y);
    else if (x.kind === "array") {
      if (x.shape.length === 1 && x.data.every((v) => v.kind === "number")) {
        const idx = x.data.map((v) => v.data);
        if (idx.length !== y.shape.length)
          throw err("Index must have same length as source's rank");
        const d = idx.reduce((tot, ax, i) => {
          const yax = y.shape[i];
          if (ax < 0) ax += yax;
          if (ax >= yax || ax < 0)
            throw err(`Index ${ax} out of bounds for length ${yax}`);
          return tot * yax + ax;
        }, 0);
        return y.data[d];
      }
      return each((i) => pick(i, y), x);
    } else throw err("Invalid indices to pick");
  }),
);
export const tak = df("↑", "take", (err) =>
  recur((take, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
    if (x.kind === "number") {
      const cel = cells(y, -1);
      const len = y.shape[0];
      if (x.data > len || x.data < -len)
        throw err(`Take amount outside of bounds for length ${len}`);
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
    } else throw err("Invalid x");
  }),
);
export const dro = df("↓", "drop", (err) =>
  recur((drop, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
    if (x.kind === "number") {
      const cel = cells(y, -1);
      const len = y.shape[0];
      if (x.data > len || x.data < -len)
        throw err(`Take amount outside of bounds for length ${len}`);
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
    } else throw err("Invalid x");
  }),
);
export const rot = df("⌽", "rotate", (err) =>
  recur((rot, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
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
    } else throw err("Invalid x");
  }),
);
export const gro = df("⊔", "group", (err) => (x, y) => {
  const cel = cells(y, -1);
  const [len] = cel.shape;
  if (
    x.kind !== "array" ||
    x.shape.length !== 1 ||
    !x.data.every((v) => v.kind === "number")
  )
    throw err("x must be a list of numbers");
  if (x.shape[0] !== len) throw err("Group arguments must have equal length");
  const buckets: Val[][] = [];
  for (let i = 0; i < len; i++) {
    const gi = x.data[i].data;
    if (gi < 0 || gi > len || !Number.isInteger(gi))
      throw err(
        "Group indices must be integers between 0 and the array length",
      );
    if (gi >= buckets.length) while (buckets.length <= gi) buckets.push([]);
    buckets[gi].push(cel.data[i]);
  }
  return fromCells(buckets.map(fromCells));
});

export const slf = mm("⍨", "self/const1", () => (y) => {
  return F(1, y.kind === "function" ? (v) => y.data(v, v) : (_) => y);
});
export const bac = mm("˜", "backward/const2", () => (y) => {
  return F(2, y.kind === "function" ? (g, h) => y.data(h, g) : (_) => y);
});
export const cel = mm("◡", "cells", () => (y) => rank(y, N(-1)));
export const con = mm("⊙", "contents", (err) => (y) => {
  if (y.kind !== "function") throw err("X contents must be a function");
  return F(y.arity, (...v) => y.data(...v.map((x) => x && disclose(x))));
});
export const eac = mm("¨", "each", (err) => (y) => {
  if (y.kind !== "function") throw err("X must be a function");
  return F(y.arity, (...x) => each(y.data, ...x));
});
export const red = mm("/", "reduce", (err) => (y) => {
  if (y.kind !== "function" || y.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, (x) => {
    if (x.kind !== "array") return x;
    if (x.data.length === 0) throw err("Cannot reduce empty array");
    const c = cells(x, -1);
    return c.data.reduce((acc, val) => y.data(acc, val));
  });
});
export const sca = mm("\\", "scan", (err) => (y) => {
  if (y.kind !== "function" || y.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, (x) => {
    if (x.kind !== "array") throw err(`Cannot scan ${x.kind}`);
    const cel = cells(x, -1);
    const o = [cel.data[0]];
    for (let i = 1, acc = cel.data[0]; i < cel.shape[0]; i++) {
      o.push((acc = y.data(acc, cel.data[i])));
    }
    return A(cel.shape, o);
  });
});
export const fol = mm("⫽", "fold", (err) => (y) => {
  if (y.kind !== "function" || y.arity !== 2)
    throw err("X must be a dyadic function");
  return F(2, (v, w) => {
    if (w.kind !== "array") throw err(`Cannot reduce ${w.kind}`);
    const c = cells(w, -1);
    return c.data.reduce((acc, val) => y.data(acc, val), v);
  });
});
export const tab = mm("⊞", "table", (err) => (y) => {
  if (y.kind !== "function" || y.arity !== 2)
    throw err("X must be a dyadic function");
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
});
export const win = mm("⊕", "windows", (err) => (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (X.arity === 2)
    return F(1, (w) => {
      if (w.kind !== "array") throw err("Windows must be given an array");
      const { data } = cells(w, -1);
      const l = data.length - 1;
      const o = A([l], []);
      for (let i = 1; i <= l; i++) o.data.push(X.data(data[i - 1], data[i]));
      return o;
    });
  else
    return F(2, (v, w) => {
      if (w.kind !== "array") throw err("Windows must be given an array");
      if (v.kind === "number") {
        const wn = v.data;
        const { data } = cells(w, -1);
        const l = data.length;
        if (!Number.isInteger(wn) || wn < 2 || wn > l)
          throw err(
            "Window amount must be an integer between 2 and the array's length",
          );
        const len = 1 + l - wn;
        const o = A([len], []);
        for (let i = 0; i < len; i++)
          o.data.push(X.data(A([wn], data.slice(i, i + wn))));
        return o;
      }
      throw err("Windows can only take a number for now");
    });
});
export const rep = mm("↺", "repeat", (err) => (y) => {
  if (y.kind !== "function") throw err("X must be a function");
  const fn = y.arity === 2 ? y.data : (_: Val, v: Val) => y.data(v);
  return F(2, (w, x) => {
    if (w.kind !== "number" || !(Number.isInteger(w.data) && w.data >= 0))
      throw err("Repetition count must be a nonnegative integer");
    let cur: Val = x;
    for (let i = 0; i < w.data; i++) {
      cur = fn(N(i), cur);
    }
    return cur;
  });
});

export const unt = dm("⍣", "until", (err) => (x, y) => {
  if (x.kind !== "function" || (y.kind !== "function" && y.kind !== "number"))
    throw err("Invalid operand types to until");
  const iter = x.arity === 2 ? x.data : (_: Val, v: Val) => x.data(v);
  const cond = y.kind === "function" ? y : F(1, () => y);
  const end = (...v: Val[]) => {
    const r = cond.data(...v);
    if (r.kind !== "number" && (r.data === 0 || r.data === 1))
      throw err("Condition function must return a boolean");
    return r.data;
  };
  const maxIter = 10000;
  if (cond.arity === 1)
    return F(x.arity, (v, w) => {
      let g = x.arity === 1 ? v : w;
      for (let i = 0; !end(g); i++) {
        if (i > maxIter)
          throw err(
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
    throw err(`Maximum iteration count reached; last value ${display(g)}`);
  });
});
export const und = dm("⍢", "under", (err) => (x, y) => {
  if (x.kind !== "function" || y.kind !== "function")
    throw err("Operands to under must both be functions");
  const arity = Math.max(x.arity, y.arity);
  return F(arity, (...v) => {
    const arr = v[arity - 1];
    if (arr.kind !== "array") throw err("Under argument must be an array");
    const indices = int.def(sha.def(arr));
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
        throw err("Invalid transformation");
      const dat = x.data(t);
      if (dat.kind !== "array" || !match(dat.shape, t.shape))
        throw err("Function cannot change shape");
      return each((v) => {
        const i = v.data as number;
        const g = ti.data.findIndex((z) => z.data === i);
        if (g === -1) return arr.data[i];
        return dat.data[g];
      }, indices);
    } else {
      throw err("Under transformation must return a number or number array");
    }
  });
});
export const cho = dm("◶", "choose", (err) => (x, y) => {
  if (x.kind !== "array" || x.shape.length !== 1)
    throw err("Left operand to choose must be a list");
  if (y.kind !== "function")
    throw err("Right operand to choose must be a function");
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
      throw err("Invalid choose index");
    return cfs[idx.data](...v);
  });
});
export const bef = dm("⊸", "before", (err) => (x, y) => {
  if (y.kind !== "function")
    throw err("Right operand to before must be a function");
  if (y.arity === 1) return aft.def(y, x);
  const l = x.kind === "function" ? x : F(1, () => x);
  return F(l.arity, (v, w) => y.data(l.data(v, w), l.arity === 1 ? v : w));
});
export const aft = dm("⟜", "after", (err) => (x, y) => {
  if (x.kind !== "function")
    throw err("Left operand to after must be a dyadic function");
  if (y.kind !== "function") {
    if (x.arity === 1) return x.data(y);
    return F(1, (v) => x.data(v, y));
  }
  if (x.arity === 1) return F(y.arity, (...v) => x.data(y.data(...v)));
  return F(2, (v, w) => x.data(v, y.arity === 1 ? y.data(w) : y.data(v, w)));
});
export const ov = dm("○", "over", (err) => (x, y) => {
  if (x.kind !== "function" || y.kind !== "function")
    throw err("Operands to over must both be functions");
  if (x.arity !== 2) throw err("Left operand to over must be dyadic");
  return F(2, (n, m) =>
    y.arity === 1
      ? x.data(y.data(n), y.data(m))
      : x.data(y.data(m, n), y.data(n, m)),
  );
});

export const lft = df("⊣", "left argument", () => (x, _) => x);
export const rgt = df("⊢", "right argument", () => (_, y) => y);
export const id = mf("⋅", "identity", () => (y) => y);
