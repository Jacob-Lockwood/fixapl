import {
  type Val,
  A,
  F,
  C,
  N,
  match,
  range,
  execnoad,
  list,
  fromCells,
  map,
  each,
  cells,
  recur,
  pervasive,
  asyncEvery,
  Atom,
  Arr,
  asyncMap,
} from "./util";
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

function disclose(y: Val) {
  return y.kind === "array" ? y.data[0] : y;
}
function shape(y: Val) {
  if (y.kind !== "array") return A([0], []);
  return A([y.shape.length], y.shape.map(N));
}
function greater(x: Atom, y: Atom) {
  if (x.kind === "function" || y.kind === "function")
    throw new Error("Cannot compare functions");
  if (x.kind === y.kind) return x.data > y.data;
  return x.kind === "character";
}
function equal(x: Atom, y: Atom) {
  if (x.kind === "function" || y.kind === "function") return false;
  return x.kind === y.kind && x.data === y.data;
}
function vMatch(x: Val, y: Val): boolean {
  if (x.kind !== y.kind) return false;
  if (x.kind !== "array") return x.data === y.data;
  if (y.kind !== "array") throw new Error("unreachable");
  if (!match(x.shape, y.shape)) return false;
  return x.data.every((v, i) => vMatch(v, y.data[i]));
}
function compare(x: Val, y: Val) {
  if (x.kind === "array" || y.kind === "array")
    throw new Error("Cannot compare arrays");
  return greater(x, y) ? 1 : equal(x, y) ? 0 : -1;
}

export type Entry = {
  kind: PrimitiveKind;
  glyph: string;
  name: string;
  def: (...v: Val[]) => Promise<Val>;
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
    ) => (...xs: Val[]) => Promise<Val>,
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
  pervasive(async (x, y) => N(equal(x, y) ? 1 : 0)),
);
export const ne = df("≠", "not equal", () =>
  pervasive(async (x, y) => N(equal(x, y) ? 0 : 1)),
);
export const grt = df(">", "greater than", () =>
  pervasive(async (x, y) => N(greater(x, y) ? 1 : 0)),
);
export const gte = df("≥", "greater or equal", () =>
  pervasive(async (x, y) => N(greater(x, y) || equal(x, y) ? 1 : 0)),
);
export const les = df("<", "less than", () =>
  pervasive(async (x, y) => N(greater(x, y) || equal(x, y) ? 0 : 1)),
);
export const lte = df("≤", "less or equal", () =>
  pervasive(async (x, y) => N(greater(x, y) ? 0 : 1)),
);

export const not = mf("¬", "not", () => (y) => sub.def(N(1), y));
export const ng = mf("¯", "negate", (err) =>
  pervasive(async (y) => {
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
  pervasive(async (y) => {
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
  pervasive(async (y) => {
    if (y.kind === "character")
      return C(String.fromCodePoint(y.data).toUpperCase());
    if (y.kind === "number") return N(Math.abs(y.data));
    throw err(`y can only be numbers or characters`);
  }),
);
export const sqr = mf("√", "square root", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.sqrt(y.data));
    throw err(`square root is only defined for numbers`);
  }),
);
export const flo = mf("⌊", "floor", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.floor(y.data));
    throw err(`y must be numbers`);
  }),
);
export const rou = mf("⁅", "round", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.round(y.data));
    throw err(`y must be numbers`);
  }),
);
export const cei = mf("⌈", "ceiling", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.ceil(y.data));
    throw err(`y must be numbers`);
  }),
);
export const rol = mf("?", "roll", (err) =>
  pervasive(async (y) => {
    if (y.kind !== "number" || !Number.isInteger(y.data) || y.data < 0)
      throw err("y must be nonnegative integers");
    return N(y.data === 0 ? Math.random() : Math.floor(Math.random() * y.data));
  }),
);

export const add = df("+", "add", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "function" || y.kind === "function")
      throw err("Cannot add functions");
    if (x.kind === "character" && y.kind === "character")
      throw err("Cannot add two characters");
    const kind = x.kind === "character" ? x.kind : y.kind;
    return { kind, data: x.data + y.data };
  }),
);
export const sub = df("-", "subtract", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "character" && y.kind === "character")
      return N(x.data - y.data);
    if (y.kind !== "number")
      throw err(`Cannot subtract ${y.kind} from ${x.kind}`);
    if (x.kind === "function") throw err(`Cannot subtract a function`);
    return { kind: x.kind, data: x.data - y.data };
  }),
);
export const mul = df("×", "multiply", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data * y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const div = df("÷", "divide", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data / y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const mod = df("|", "modulo", (err) =>
  pervasive(async (x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw err(`x and y must be numbers`);
    return N(y.data >= 0 ? y.data % x.data : x.data + (y.data % x.data));
  }),
);
export const pow = df("*", "power", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data ** y.data);
    throw err(`x and y must be numbers`);
  }),
);
export const log = df("⍟", "logarithm", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number")
      return N(Math.log(y.data) / Math.log(x.data));
    throw err(`x and y must be numbers`);
  }),
);
export const max = df("↥", "maximum", () =>
  pervasive(async (x, y) => ((await grt.def(x, y)).data ? x : y)),
);
export const min = df("↧", "minimum", () =>
  pervasive(async (x, y) => ((await grt.def(y, x)).data ? x : y)),
);

export const rev = mf("⋈", "reverse", () => async (y) => {
  return y.kind === "array" ? A(y.shape, [...y.data].reverse()) : y;
});
export const tra = mf("⍉", "transpose", () => async (y) => {
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
export const int = mf("⍳", "integers", (err) => async (y) => {
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
export const len = mf("⧻", "length", () => async (y) => {
  return N(y.kind === "array" ? (y.shape[0] ?? 0) : 0);
});
export const sha = mf("△", "shape", () => async (y) => shape(y));
export const fla = mf(
  "▽",
  "flat",
  () => async (y) =>
    y.kind === "array" ? A([y.shape.reduce((x, y) => x * y, 1)], y.data) : y,
);
export const enc = mf("□", "enclose", () => async (y) => A([], [y]));
export const enl = mf("⋄", "enlist", () => async (y) => A([1], [y]));
export const mer = mf("⊡", "merge", (err) => async (y) => {
  if (y.kind !== "array") return y;
  const [sh, ...shs] = y.data.map(shape);
  if (!asyncEvery(shs, async (v) => (await mat.def(v, sh)).data))
    throw err("Cannot merge elements whose shapes do not match");
  const newsh = y.shape.concat(sh.data.map((x) => x.data as number));
  const dat = y.data.flatMap((x) => (x.kind === "array" ? x.data : x));
  return A(newsh, dat);
});
export const whe = mf("⊚", "where", (err) => async (y) => {
  if (y.kind === "number") y = A([1], [y]);
  if (y.kind !== "array" || y.shape.length !== 1) throw err("y must be a list");
  return list(
    y.data.flatMap((v, i) => {
      if (v.kind !== "number") throw err("y can only contain numbers");
      return Array(v.data).fill(N(i)) as Val[];
    }),
  );
});
export const gru = mf("⍋", "grade up", (err) => async (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err("Grade argument must be a list");
  const d = y.data;
  const s = d.map((_, i) => i).sort((a, b) => compare(d[a], d[b]));
  return list(s.map(N));
});
export const grd = mf("⍒", "grade down", (err) => async (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err("Grade argument must be a list");
  const d = y.data;
  const s = d.map((_, i) => i).sort((a, b) => -compare(d[a], d[b]));
  return list(s.map(N));
});
export const sru = mf("⊴", "sort up", () => async (y) => {
  return sel.def(await gru.def(y), y);
});
export const srd = mf("⊵", "sort down", () => async (y) => {
  return sel.def(await grd.def(y), y);
});

export const mem = df("∊", "member of", (err) => (x, y) => {
  if (y.kind !== "array" || y.shape.length < 1)
    throw err("y must have rank at least 1");
  return map(
    async (e) => N(y.data.some((v) => vMatch(e, v)) ? 1 : 0),
    x.kind === "array" ? x : A([], [x]),
  );
});
export const mat = df("≡", "match", () => async (x, y) => {
  return N(vMatch(x, y) ? 1 : 0);
});
export const nmt = df("≢", "nomatch", () => async (x, y) => {
  return N(vMatch(x, y) ? 0 : 1);
});
export const pai = df("⍮", "pair", () => async (x, y) => A([2], [x, y]));
export const cat = df("⍪", "catenate", (err) =>
  recur(async (cat, x, y) => {
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
        .map(() => y);
      return cat(x, A(sh, d));
    } else if (y.kind === "array") {
      const sh = [1, ...y.shape.slice(1)];
      const d = Array(sh.reduce((a, b) => a * b))
        .fill(0)
        .map(() => x);
      return cat(A(sh, d), y);
    } else {
      return A([2], [x, y]);
    }
  }),
);
export const res = df("⍴", "reshape", (err) => async (x, y) => {
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
export const rpl = df("⌿", "replicate", (err) => async (x, y) => {
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
export const sel = df("⊇", "select", (err) => async (x, y) => {
  if (y.kind !== "array") throw err("y must be an array");
  const c = cells(y);
  const len = y.shape[0];
  return mer.def(
    await each(async (v) => {
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
  recur(async (pick, x, y) => {
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
  fn: (x: Extract<Val, { kind: "number" }>, y: Arr) => Promise<Val>,
) =>
  recur(async (g, x, y) => {
    if (y.kind !== "array") throw err("y must be an array");
    if (x.kind === "number") {
      return fn(x, y);
    } else if (x.kind === "array" && x.data.every((v) => v.kind === "number")) {
      const arr = await g(x.data[0], y);
      if (x.data.length === 1) return arr;
      return mer.def(
        await map(
          (z) => g(A([x.shape[0] - 1], x.data.slice(1)), z),
          cells(arr),
        ),
      );
    } else throw err("Invalid x");
  });
export const tak = df("↑", "take", (err) =>
  eachAxis(err, async (x, y) => {
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
  eachAxis(err, async (x, y) => {
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
  eachAxis(err, async (x, y) => {
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
export const gro = df("⊔", "group", (err) => async (x, y) => {
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
export const slf = mm("⍨", "self/const1", () => async (X) => {
  return F(1, X.kind === "function" ? (v) => X.data(v, v) : async () => X);
});
export const bac = mm("˜", "backward/const2", () => async (X) => {
  return F(2, X.kind === "function" ? (g, h) => X.data(h, g) : async () => X);
});
export const cel = mm("◡", "cells", () => (X) => rnk.def(X, N(-1)));
export const con = mm("⊙", "contents", (err) => async (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  return F(X.arity, (...v) => X.data(...v.map((z) => z && disclose(z))));
});
export const eac = mm("¨", "each", (err) => async (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  return F(X.arity, (...x) => each(X.data, ...x));
});
export const red = mm("/", "reduce", (err, { err1 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, async (y) => {
    if (y.kind !== "array") return y;
    if (y.data.length === 0) throw err1("y may not be empty");
    const cel = cells(y);
    let acc = cel.data[0];
    for (let i = 1; i < cel.shape[0]; i++) acc = await X.data(acc, cel.data[i]);
    return acc;
  });
});
export const sca = mm("\\", "scan", (err, { err1 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(1, async (y) => {
    if (y.kind !== "array") throw err1(`y must be an array`);
    const cel = cells(y);
    const o = [cel.data[0]];
    for (let i = 1, acc = cel.data[0]; i < cel.shape[0]; i++) {
      o.push((acc = await X.data(acc, cel.data[i])));
    }
    return fromCells(o);
  });
});
export const fol = mm("⫽", "fold", (err, { err2 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(2, async (v, w) => {
    if (w.kind !== "array") throw err2(`y must be an array`);
    const cel = cells(w);
    for (let i = 0; i < cel.shape[0]; i++) v = await X.data(v, cel.data[i]);
    return v;
  });
});
export const tab = mm("⊞", "table", (err) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err("X must be a dyadic function");
  return F(2, async (v, w) => {
    const sv = v.kind === "array" ? v.shape.slice(0, 1) : [];
    const sw = w.kind === "array" ? w.shape.slice(0, 1) : [];
    const shape = sv.concat(sw);
    const cv = cells(v);
    const cw = cells(w);
    const o: Val[] = [];
    for (const h of cv.data)
      for (const g of cw.data) o.push(await X.data(h, g));
    return A(shape, o);
  });
});
export const win = mm("⊕", "windows", (err, { err1, err2 }) => async (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (X.arity === 2)
    return F(1, async (w) => {
      if (w.kind !== "array") throw err1("y must be an array");
      const { data } = cells(w);
      const l = data.length - 1;
      const o = A([l], []);
      for (let i = 1; i <= l; i++)
        o.data.push(await X.data(data[i - 1], data[i]));
      return o;
    });
  else
    return F(2, async (v, w) => {
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
          o.push(await X.data(fromCells(data.slice(i, i + wn))));
        return fromCells(o);
      }
      throw err2("x can only be a number for now");
    });
});
export const rep = mm("↺", "repeat", (err, { err2 }) => async (X) => {
  if (X.kind !== "function") throw err("X must be a function");
  const fn = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  return F(2, async (v, w) => {
    if (v.kind !== "number" || !Number.isInteger(v.data) || v.data < 0)
      throw err2("x must be a nonnegative integer");
    let cur = w;
    for (let i = 0; i < v.data; i++) {
      cur = await execnoad(await fn(N(i), cur));
    }
    return cur;
  });
});

export const unt = dm("⍣", "until", (err, r) => async (X, Y) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (Y.kind !== "function" && Y.kind !== "number")
    throw err("Y must be a function or number");
  const iter = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  const cond = Y.kind === "function" ? Y : F(1, async () => Y);
  const e = X.arity === 1 ? r.err1 : r.err2;
  const end = async (...v: Val[]) => {
    const r = await execnoad(await cond.data(...v));
    if (r.kind === "number" && (r.data === 0 || r.data === 1)) return r.data;
    throw e("Condition function must return a boolean");
  };
  const iterr = (v: Val) =>
    e(`Maximum iteration count reached; last value:\n${display(v)}`);
  const maxIter = 10000;
  if (cond.arity === 1)
    return F(X.arity, async (v, w) => {
      let g = X.arity === 1 ? v : w;
      for (let i = 0; !(await end(g)); i++) {
        if (i > maxIter) throw iterr(g);
        g = await iter(v, g);
      }
      return g;
    });
  return F(X.arity, async (v, w) => {
    let g = X.arity === 1 ? v : w;
    let h: Val;
    for (let i = 0; i < maxIter; i++) {
      h = await iter(v, g);
      if (await end(g, h)) return h;
      i++;
      g = await iter(v, h);
      if (await end(h, g)) return g;
    }
    throw iterr(g);
  });
});
export const und = dm("⍢", "under", (err, r) => async (X, Y) => {
  if (X.kind !== "function" || Y.kind !== "function")
    throw err("X and Y must both be functions");
  const arity = Math.max(X.arity, Y.arity);
  const e = arity === 1 ? r.err1 : r.err2;
  return F(arity, async (...v) => {
    const arr = v[arity - 1];
    if (arr.kind !== "array") throw e("y must be an array");
    const indices = await int.def(shape(arr));
    const [t, ti] = await asyncMap([arr, indices], async (z) =>
      execnoad(Y.arity === 1 ? await Y.data(z) : await Y.data(v[0], z)),
    );
    const isOk = (x: Val) =>
      x.kind === "number" &&
      x.data >= 0 &&
      x.data < arr.data.length &&
      Number.isInteger(x.data);
    if (isOk(ti)) {
      const i = ti.data as number;
      const z = await execnoad(await X.data(t));
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
      const dat = await execnoad(await X.data(t));
      if (dat.kind !== "array" || !match(dat.shape, t.shape))
        throw e("Function cannot change shape");
      return each(async (v) => {
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
export const rnk = dm("⍤", "rank", (err) => async (X, Y) => {
  Y = await execnoad(Y);
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
  return F(X.arity, async (...xs: Val[]) => {
    const cs = xs.map((y, i) => cells(y, r[i] ?? r[0]));
    return mer.def(await each(X.data, ...cs));
  });
});
export const dbg = dm("⬚", "debug", () => pai.def);
export const cho = dm("◶", "choose", (err, r) => async (X, Y) => {
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
  return F(arity, async (...v) => {
    const idx = await cond(...v);
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
export const bef = dm("⊸", "before", (err) => async (X, Y) => {
  if (Y.kind !== "function") throw err("Y must be a function");
  if (Y.arity === 1) return aft.def(Y, X);
  const l = X.kind === "function" ? X : F(1, async () => X);
  return F(l.arity, async (v, w) =>
    Y.data(await l.data(v, w), l.arity === 1 ? v : w),
  );
});
export const aft = dm("⟜", "after", (err) => async (X, Y) => {
  if (X.kind !== "function") throw err("X must be a function");
  if (Y.kind !== "function") {
    if (X.arity === 1) return X.data(Y);
    return F(1, (v) => X.data(v, Y));
  }
  if (X.arity === 1)
    return F(Y.arity, async (...v) => X.data(await Y.data(...v)));
  return F(2, async (v, w) =>
    X.data(v, Y.arity === 1 ? await Y.data(w) : await Y.data(v, w)),
  );
});
export const ov = dm("○", "over", (err) => async (X, Y) => {
  if (X.kind !== "function" || Y.kind !== "function")
    throw err("X and Y must both be functions");
  if (X.arity !== 2) throw err("X must be dyadic");
  return F(2, async (v, w) =>
    Y.arity === 1
      ? X.data(await Y.data(v), await Y.data(w))
      : X.data(await Y.data(w, v), await Y.data(v, w)),
  );
});

export const lft = df("⊣", "left argument", () => async (x) => x);
export const rgt = df("⊢", "right argument", () => async (_, y) => y);
export const id = mf("⋅", "identity", () => async (y) => y);
export const sb = mm("₀", "subject", () => async (X) => F(0, async () => X));
export const mn = mm("₁", "monad", (err) => async (X) => {
  X = await execnoad(X);
  if (X.kind !== "function") return F(1, async () => X);
  if (X.arity === 2) throw err("Cannot coerce dyad to monad");
  return X;
});
export const dy = mm("₂", "dyad", () => async (X) => {
  X = await execnoad(X);
  if (X.kind !== "function") return F(2, async () => X);
  if (X.arity === 1) return F(2, (_, y) => X.data(y));
  return X;
});

export const inf = ct("∞", "infinity", () => N(Infinity));
export const pi = ct("π", "pi", () => N(Math.PI));
export const tau = ct("τ", "pi", () => N(Math.PI * 2));
export const emp = ct("⍬", "empty vector", () => A([0], []));
