import { match, range, A, F, C, N, type Val, execnoad } from "./util";
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
  const c = cells(val).data;
  return `[${c.map(display).join(", ")}]`;
}

const list = (arr: Val[]) => A([arr.length], arr);
function fromCells(arr: Val[]) {
  const isA = arr[0].kind === "array";
  const sh = isA ? (arr[0] as Val & { kind: "array" }).shape : [];
  const d = arr.flatMap((v) => {
    if (!isA && v.kind !== "array") return v;
    if (isA && v.kind === "array" && match(sh, v.shape)) return v.data;
    throw new Error("Cannot construct array from cells whose shapes differ");
  });
  return A([arr.length, ...sh], d);
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
function cells(arr: Val, r = -1) {
  if (arr.kind !== "array") return A([], [arr]);
  if (r === 0) return arr;
  const frame = arr.shape.slice(0, -r);
  const cell = arr.shape.slice(-r);
  // if (cell.length === 0) return arr;
  const delta = cell.reduce((a, b) => a * b, 1);
  const data: Val[] = [];
  for (let i = 0; i < arr.data.length; i += delta) {
    const chunk = arr.data.slice(i, i + delta);
    data.push(A(cell, chunk));
  }
  return A(frame, data);
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
    fn: (
      err: (s: string) => Error,
      r: Record<"err1" | "err2", (s: string) => Error>,
    ) => (...xs: Val[]) => Val,
  ): Entry => {
    order.push(glyph);
    const e = err(glyph);
    const e1 = `(${e})y`;
    const e2 = `x${e1}`;
    const [f, err1, err2] = [e, e1, e2].map(
      (s) => (m: string) => new Error(s + ": " + m),
    );
    return { kind, glyph, name, def: fn(f, { err1, err2 }) };
  };
const df = metaEntry("dyadic function", (g) => `x${g}y`);
const mf = metaEntry("monadic function", (g) => `${g}y`);
const dm = metaEntry("dyadic modifier", (g) => `X${g}Y`);
const mm = metaEntry("monadic modifier", (g) => `X${g}`);

const ct = (glyph: string, name: string, def: () => Val) => {
  order.push(glyph);
  return { kind: "constant" as const, glyph, name, def };
};

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
    if (x.kind === "number" && y.kind === "number") return N(x.data / y.data);
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
export const whe = mf("⊚", "where", (err) => (y) => {
  if (y.kind === "number") y = A([1], [y]);
  if (y.kind !== "array" || y.shape.length !== 1) throw err("y must be a list");
  return list(
    y.data.flatMap((v, i) => {
      if (v.kind !== "number") throw err("y can only contain numbers");
      return Array(v.data).fill(N(i)) as Val[];
    }),
  );
});
export const gru = mf("⍋", "grade up", (err) => (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err("Grade argument must be a list");
  const d = y.data;
  const s = d.map((_, i) => i).sort((a, b) => compare(d[a], d[b]));
  return list(s.map(N));
});
export const grd = mf("⍒", "grade down", (err) => (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err("Grade argument must be a list");
  const d = y.data;
  const s = d.map((_, i) => i).sort((a, b) => -compare(d[a], d[b]));
  return list(s.map(N));
});
export const sru = mf("⊴", "sort up", () => (y) => sel.def(gru.def(y), y));
export const srd = mf("⊵", "sort down", () => (y) => sel.def(grd.def(y), y));

export const mem = df("∊", "member of", (err) => (x, y) => {
  if (y.kind !== "array" || y.shape.length < 1)
    throw err("y must have rank at least 1");
  return map(
    (e) => N(y.data.some((v) => mat.def(e, v).data === 1) ? 1 : 0),
    x.kind === "array" ? x : A([], [x]),
  );
});
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
export const pai = df("⍮", "pair", () => (x, y) => A([2], [x, y]));
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
  const cel = cells(y);
  const isOk = (v: Val) =>
    v.kind === "number" && v.data >= 0 && Number.isInteger(v.data);
  if (
    !isOk(x) &&
    (x.kind !== "array" || (x.shape.length !== 1 && !x.data.every(isOk)))
  )
    throw err("x must be a nonnegative integer or nonnegative integer list");
  const amounts = (x.kind === "array" ? x.data : [x]).map(
    (v) => v.data as number,
  );
  if (amounts.length > cel.shape[0])
    throw err("Replicate amount may not be longer than array");
  const d = cel.data.flatMap((v, i) => {
    const l = amounts[i % amounts.length];
    return Array(l).fill(v.data).flat() as Val[];
  });
  return list(d);
});
export const sel = df("⊇", "select", (err) => (x, y) => {
  if (y.kind !== "array") throw err("y must be an array");
  const c = cells(y);
  const len = y.shape[0];
  return mer.def(
    each((v) => {
      if (v.kind !== "number") throw err("Cannot select non-number");
      let i = v.data;
      if (i < 0) i += len;
      if (i >= len || i < 0)
        throw err(`Index ${i} out of bounds for length ${len}`);
      return c.data[i];
    }, x),
  );
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
const eachAxis = (
  err: (m: string) => Error,
  fn: (x: Val & { kind: "number" }, y: Val & { kind: "array" }) => Val,
) =>
  recur((g, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
    if (x.kind === "number") {
      return fn(x, y);
    } else if (x.kind === "array" && x.data.every((v) => v.kind === "number")) {
      const arr = g(x.data[0], y);
      if (x.data.length === 1) return arr;
      return mer.def(
        map((z) => g(A([x.shape[0] - 1], x.data.slice(1)), z), cells(arr)),
      );
    } else throw err("Invalid x");
  });
export const tak = df("↑", "take", (err) =>
  eachAxis(err, (x, y) => {
    const cel = cells(y);
    const len = y.shape[0];
    if (x.data > len || x.data < -len)
      throw err(`Take amount outside of bounds for length ${len}`);
    const d = x.data < 0 ? cel.data.slice(x.data) : cel.data.slice(0, x.data);
    return A(
      [d.length, ...y.shape.slice(1)],
      d.flatMap((x) => (x.kind === "array" ? x.data : x)),
    );
  }),
);
export const dro = df("↓", "drop", (err) =>
  eachAxis(err, (x, y) => {
    const cel = cells(y);
    const len = y.shape[0];
    if (x.data > len || x.data < -len)
      throw err(`Take amount outside of bounds for length ${len}`);
    const d = x.data < 0 ? cel.data.slice(0, x.data) : cel.data.slice(x.data);
    return A(
      [d.length, ...y.shape.slice(1)],
      d.flatMap((x) => (x.kind === "array" ? x.data : x)),
    );
  }),
);
export const rot = df("⌽", "rotate", (err) =>
  eachAxis(err, (x, y) => {
    const cel = cells(y);
    const len = y.shape[0];
    const rot = (x.data % len) + (x.data < 0 ? len : 0);
    const d = cel.data.slice(rot).concat(cel.data.slice(0, rot));
    return A(
      [d.length, ...y.shape.slice(1)],
      d.flatMap((x) => (x.kind === "array" ? x.data : x)),
    );
  }),
);
export const gro = df("⊔", "group", (err) => (x, y) => {
  const cel = cells(y);
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
    if (gi > len || !Number.isInteger(gi))
      throw err("Group indices must be integers less than the array length");
    if (gi < 0) continue;
    if (gi >= buckets.length) while (buckets.length <= gi) buckets.push([]);
    buckets[gi].push(cel.data[i]);
  }
  return list(buckets.map(fromCells));
});
export const slf = mm("⍨", "self/const1", () => (X) => {
  return F(1, X.kind === "function" ? (v) => X.data(v, v) : (_) => X);
});
export const bac = mm("˜", "backward/const2", () => (X) => {
  return F(2, X.kind === "function" ? (g, h) => X.data(h, g) : (_) => X);
});
export const cel = mm("◡", "cells", () => (X) => rnk.def(X, N(-1)));
export const con = mm("⊙", "contents", (err) => (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  return F(X.arity, (...v) => X.data(...v.map((z) => z && disclose(z))));
});
export const eac = mm("¨", "each", (err) => (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  return F(X.arity, (...x) => each(X.data, ...x));
});
export const red = mm("/", "reduce", (err, { err1 }) => (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, (y) => {
    if (y.kind !== "array") return y;
    if (y.data.length === 0) throw err1("y may not be empty");
    const c = cells(y);
    return c.data.reduce((acc, val) => X.data(acc, val));
  });
});
export const sca = mm("\\", "scan", (err, { err1 }) => (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, (y) => {
    if (y.kind !== "array") throw err1(`y must be an array`);
    const cel = cells(y);
    const o = [cel.data[0]];
    for (let i = 1, acc = cel.data[0]; i < cel.shape[0]; i++) {
      o.push((acc = X.data(acc, cel.data[i])));
    }
    return fromCells(o);
  });
});
export const fol = mm("⫽", "fold", (err, { err2 }) => (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(2, (v, w) => {
    if (w.kind !== "array") throw err2(`y must be an array`);
    const c = cells(w);
    return c.data.reduce((acc, val) => X.data(acc, val), v);
  });
});
export const tab = mm("⊞", "table", (err) => (y) => {
  if (y.kind !== "function" || y.arity !== 2)
    throw err("X must be a dyadic function");
  return F(2, (v, w) => {
    const sv = v.kind === "array" ? v.shape.slice(0, 1) : [];
    const sw = w.kind === "array" ? w.shape.slice(0, 1) : [];
    const shape = sv.concat(sw);
    const cv = cells(v);
    const cw = cells(w);
    const o = [];
    for (const h of cv.data) for (const g of cw.data) o.push(y.data(h, g));
    return A(shape, o);
  });
});
export const win = mm("⊕", "windows", (err, { err1, err2 }) => (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (X.arity === 2)
    return F(1, (w) => {
      if (w.kind !== "array") throw err1("y must be an array");
      const { data } = cells(w);
      const l = data.length - 1;
      const o = A([l], []);
      for (let i = 1; i <= l; i++) o.data.push(X.data(data[i - 1], data[i]));
      return o;
    });
  else
    return F(2, (v, w) => {
      if (w.kind !== "array") throw err2("y must be an array");
      if (v.kind === "number") {
        const wn = v.data;
        const { data } = cells(w);
        const l = data.length;
        if (wn < 1 || !Number.isInteger(wn))
          throw err2("x must be a positive integer");
        if (wn > l) return A([0], []);
        const len = 1 + l - wn;
        const o = [];
        for (let i = 0; i < len; i++)
          o.push(X.data(fromCells(data.slice(i, i + wn))));
        return fromCells(o);
      }
      throw err2("x can only be a number for now");
    });
});
export const rep = mm("↺", "repeat", (err, { err2 }) => (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  const fn = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  return F(2, (v, w) => {
    if (v.kind !== "number" || !Number.isInteger(v.data) || v.data < 0)
      throw err2("Repetition count must be a nonnegative integer");
    let cur = w;
    for (let i = 0; i < v.data; i++) cur = fn(N(i), cur);
    return cur;
  });
});

export const unt = dm("⍣", "until", (err, r) => (X, Y) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (Y.kind !== "function" && Y.kind !== "number")
    throw err("Y must be a function or number");
  const iter = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  const cond = Y.kind === "function" ? Y : F(1, () => Y);
  const e = X.arity === 1 ? r.err1 : r.err2;
  const end = (...v: Val[]) => {
    const r = execnoad(cond.data(...v));
    if (r.kind === "number" && (r.data === 0 || r.data === 1)) return r.data;
    throw e("Condition function must return a boolean");
  };
  const iterr = (v: Val) =>
    e(`Maximum iteration count reached; last value:\n${display(v)}`);
  const maxIter = 10000;
  if (cond.arity === 1)
    return F(X.arity, (v, w) => {
      let g = X.arity === 1 ? v : w;
      for (let i = 0; !end(g); i++) {
        if (i > maxIter) throw iterr(g);
        g = iter(v, g);
      }
      return g;
    });
  return F(X.arity, (v, w) => {
    let g = X.arity === 1 ? v : w;
    let h: Val;
    for (let i = 0; i < maxIter; i++) {
      h = iter(v, g);
      if (end(g, h)) return h;
      i++;
      g = iter(v, h);
      if (end(h, g)) return g;
      if (i > maxIter - 10) console.log("g", g, "h", h);
    }
    throw iterr(g);
  });
});
export const und = dm("⍢", "under", (err, r) => (X, Y) => {
  if (X.kind !== "function" || Y.kind !== "function")
    throw err("X and Y must both be functions");
  const arity = Math.max(X.arity, Y.arity);
  const e = arity === 1 ? r.err1 : r.err2;
  return F(arity, (...v) => {
    const arr = v[arity - 1];
    if (arr.kind !== "array") throw e("y must be an array");
    const indices = int.def(sha.def(arr));
    const [t, ti] = [arr, indices].map((z) =>
      execnoad(Y.arity === 1 ? Y.data(z) : Y.data(v[0], z)),
    );
    const isOk = (x: Val) =>
      x.kind === "number" &&
      x.data >= 0 &&
      x.data < arr.data.length &&
      Number.isInteger(x.data);
    if (isOk(ti)) {
      const i = ti.data as number;
      const z = execnoad(X.data(t));
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
        throw e("Invalid transformation");
      const dat = execnoad(X.data(t));
      if (dat.kind !== "array" || !match(dat.shape, t.shape))
        throw e("Function cannot change shape");
      return each((v) => {
        const i = v.data as number;
        const g = ti.data.findIndex((z) => z.data === i);
        if (g === -1) return arr.data[i];
        return dat.data[g];
      }, indices);
    } else {
      throw e("Under transformation must return a number or number array");
    }
  });
});
export const rnk = dm("⍤", "rank", (err) => (X, Y) => {
  Y = execnoad(Y);
  if (X.kind !== "function") throw err("X must be function");
  if (Y.kind === "number") Y = A([1], [Y]);
  if (Y.kind !== "array" || Y.shape.length !== 1 || Y.shape[0] === 0)
    throw err("Y must be a number or non-empty list");
  const r = Y.data.map((v) => {
    if (
      v.kind !== "number" ||
      (!Number.isInteger(v.data) && Number.isFinite(v.data))
    )
      throw err("Y may only contain integers or infinity");
    return v.data;
  });
  return F(X.arity, (...xs: Val[]) => {
    const cs = xs.map((y, i) => cells(y, r[i] ?? r[0]));
    return mer.def(each(X.data, ...cs));
  });
  // return F(X.arity, (...xs: Val[]) =>
  //   mer.def(each(X.data, ...xs.map((x, i) => cells(x, r[i] ?? r[0])))),
  // );
  /* {
    const cs = xs.map((x, i) => cells(x, r[i] ?? r[0]));
    if (cs.length === 2 && !match(cs[0].shape, cs[1].shape))
      throw err("Cannot apply at rank when cells do not match");
    const arr = map(X.data, ...cs);
    const s = shape(arr.data[0]);
    const dat = arr.data.flatMap((v) => {
      if (mat.def(s, shape(v)).data === 1) return v;
      throw err("Cannot merge arrays with mismatched shapes");
    });
    return A(arr.shape.concat(s.data.map((v) => v.data as number)), dat);
  }*/
});
// export const dbg = dm("⬚", "debug", () => pai.def);
export const cho = dm("◶", "choose", (err, r) => (X, Y) => {
  if (X.kind !== "array" || X.shape.length !== 1) throw err("X must be a list");
  if (Y.kind !== "function") throw err("Y must be a function");
  const fs = [Y, ...X.data];
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
  const e = arity === 1 ? r.err1 : r.err2;
  return F(arity, (...v) => {
    const idx = cond(...v);
    if (
      idx.kind !== "number" ||
      !Number.isInteger(idx.data) ||
      idx.data < 0 ||
      idx.data >= cfs.length
    )
      throw e("Invalid choose index");
    return cfs[idx.data](...v);
  });
});
export const bef = dm("⊸", "before", (err) => (X, Y) => {
  if (Y.kind !== "function") throw err("Y must be a function");
  if (Y.arity === 1) return aft.def(Y, X);
  const l = X.kind === "function" ? X : F(1, () => X);
  return F(l.arity, (v, w) => Y.data(l.data(v, w), l.arity === 1 ? v : w));
});
export const aft = dm("⟜", "after", (err) => (X, Y) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (Y.kind !== "function") {
    if (X.arity === 1) return X.data(Y);
    return F(1, (v) => X.data(v, Y));
  }
  if (X.arity === 1) return F(Y.arity, (...v) => X.data(Y.data(...v)));
  return F(2, (v, w) => X.data(v, Y.arity === 1 ? Y.data(w) : Y.data(v, w)));
});
export const ov = dm("○", "over", (err) => (X, Y) => {
  if (X.kind !== "function" || Y.kind !== "function")
    throw err("X and Y must both be functions");
  if (X.arity !== 2) throw err("X must be dyadic");
  return F(2, (v, w) =>
    Y.arity === 1
      ? X.data(Y.data(v), Y.data(w))
      : X.data(Y.data(w, v), Y.data(v, w)),
  );
});

export const lft = df("⊣", "left argument", () => (x, _) => x);
export const rgt = df("⊢", "right argument", () => (_, y) => y);
export const id = mf("⋅", "identity", () => (y) => y);
export const sb = mm("₀", "subject", () => (X) => F(0, () => X));
export const mn = mm("₁", "monad", (err) => (X) => {
  X = execnoad(X);
  if (X.kind !== "function") return F(1, () => X);
  if (X.arity === 2) throw err("Cannot coerce dyad to monad");
  return X;
});
export const dy = mm("₂", "dyad", () => (X) => {
  X = execnoad(X);
  if (X.kind !== "function") return F(2, () => X);
  if (X.arity === 1) return F(2, (_, y) => X.data(y));
  return X;
});

export const inf = ct("∞", "infinity", () => N(Infinity));
export const pi = ct("π", "pi", () => N(Math.PI));
export const tau = ct("τ", "pi", () => N(Math.PI * 2));
export const emp = ct("⍬", "empty vector", () => A([0], []));
