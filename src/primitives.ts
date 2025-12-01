import {
  Val,
  A,
  F,
  C,
  N,
  match,
  range,
  execnilad,
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
  indices,
  prod,
  nilad,
} from "./util";
import { PrimitiveKind } from "./glyphs";

export async function display(val: Val): Promise<string> {
  if (val.kind === "number")
    return val.data
      .toString()
      .replace("-", ng.glyph)
      .replace("Infinity", inf.glyph);
  if (val.kind === "character") {
    const j = JSON.stringify(String.fromCodePoint(val.data));
    return `'${j.slice(1, -1).replace(/'/g, "\\'")}'`;
  }
  if (val.kind === "function") {
    if (val.repr) return val.repr;
    if (val.arity === 0) {
      const v = await execnilad(val);
      return v.kind === "function" ? (await display(v)) + sb.glyph : display(v);
    } else return `<${val.arity === 1 ? "monad" : "dyad"}>`;
  }
  if (val.kind === "namespace") {
    let s = "{§";
    for (const [name, v] of val.data)
      s += ` ${lft.glyph} ${name}↤${await display(v)}`;
    return s + "}";
  }
  if (val.shape.length === 0) {
    return enc.glyph + (await display(val.data[0]));
  }
  if (val.shape.length === 1) {
    if (val.shape[0] !== 0 && val.data.every((v) => v.kind === "character")) {
      return JSON.stringify(
        String.fromCodePoint(...val.data.map((v) => v.data)),
      );
    }
    return `⟨${(await asyncMap(val.data, display)).join(", ")}⟩`;
  }
  if (val.shape[0] === 0) return `⍳${val.shape.join("‿")}`;
  const cel = cells(val).data;
  return `[${(await asyncMap(cel, display)).join(", ")}]`;
}

function shape(y: Val) {
  if (y.kind !== "array") return A([0], []);
  return A([y.shape.length], y.shape.map(N));
}
function greater(x: Atom, y: Atom) {
  if (x.kind === "function" || y.kind === "function")
    throw new Error("Cannot compare functions");
  if (x.kind === "namespace" || y.kind === "namespace")
    throw new Error("Cannot compare namespaces");
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
    const e1 = `(${e})${omega}`;
    const e2 = `${alpha}${e1}`;
    const [f, err1, err2] = [e, e1, e2].map(
      (s) => (m: string) => new Error(s + ": " + m),
    );
    return { kind, glyph, name, def: fn(f, { err1, err2 }) };
  };

const alpha = "⍺";
const omega = "⍵";
const ualpha = "⍶";
const uomega = "⍹";

const df = metaEntry("dyadic function", (g) => alpha + g + omega);
const mf = metaEntry("monadic function", (g) => g + omega);
const dm = metaEntry("dyadic modifier", (g) => ualpha + g + uomega);
const mm = metaEntry("monadic modifier", (g) => ualpha + g);

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
    throw err(`${omega} can only be numbers or characters`);
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
    throw err(`${omega} can only be numbers or characters`);
  }),
);
export const abs = mf("⌵", "absolute value", (err) =>
  pervasive(async (y) => {
    if (y.kind === "character")
      return C(String.fromCodePoint(y.data).toUpperCase());
    if (y.kind === "number") return N(Math.abs(y.data));
    throw err(`${omega} can only be numbers or characters`);
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
    throw err(`${omega} must be numbers`);
  }),
);
export const rou = mf("⁅", "round", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.round(y.data));
    throw err(`${omega} must be numbers`);
  }),
);
export const cei = mf("⌈", "ceiling", (err) =>
  pervasive(async (y) => {
    if (y.kind === "number") return N(Math.ceil(y.data));
    throw err(`${omega} must be numbers`);
  }),
);
export const rol = mf("?", "roll", (err) =>
  pervasive(async (y) => {
    if (y.kind !== "number" || !Number.isInteger(y.data) || y.data < 0)
      throw err(`${omega} must be nonnegative integers`);
    return N(y.data === 0 ? Math.random() : Math.floor(Math.random() * y.data));
  }),
);

export const add = df("+", "add", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "function" || y.kind === "function")
      throw err("Cannot add functions");
    if (x.kind === "namespace" || y.kind === "namespace")
      throw err("Cannot add namespaces");
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
    if (x.kind === "namespace") throw err(`Cannot subtract a namespace`);
    return { kind: x.kind, data: x.data - y.data };
  }),
);
export const mul = df("×", "multiply", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data * y.data);
    throw err(`${alpha} and ${omega} must be numbers`);
  }),
);
export const div = df("÷", "divide", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data / y.data);
    throw err(`${alpha} and ${omega} must be numbers`);
  }),
);
export const mod = df("|", "modulo", (err) =>
  pervasive(async (x, y) => {
    if (x.kind !== "number" || y.kind !== "number")
      throw err(`${alpha} and ${omega} must be numbers`);
    return N((x.data + (y.data % x.data)) % x.data);
  }),
);
export const pow = df("*", "power", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number") return N(x.data ** y.data);
    throw err(`${alpha} and ${omega} must be numbers`);
  }),
);
export const log = df("⍟", "logarithm", (err) =>
  pervasive(async (x, y) => {
    if (x.kind === "number" && y.kind === "number")
      return N(Math.log(y.data) / Math.log(x.data));
    throw err(`${alpha} and ${omega} must be numbers`);
  }),
);
export const max = df("↥", "maximum", () =>
  pervasive(async (x, y) => (greater(x, y) ? x : y)),
);
export const min = df("↧", "minimum", () =>
  pervasive(async (x, y) => (greater(y, x) ? x : y)),
);
// export const ecd = df("⊤", "encode", (err) =>
//   recur(async (ecd, x, y) => {
//     //! should support mixed-bases
//     if (x.kind !== "number") throw err("x must be a number");
//     //! should pad with zeroes
//     if (y.kind === "array") return each(ecd, x, y);
//     if (y.kind !== "number") throw err("y must be a number");
//     const b = x.data;
//     let v = y.data;
//     const o: number[] = [];
//     while (v) {
//       o.push(v % b);
//       v = Math.floor(v / b);
//     }
//     return list(o.map(N));
//   }),
// );
// export const dcd = df("⊥", "decode", (err) => async (x, y) => {});

export const rev = mf("⋈", "reverse", () => async (y) => {
  return y.kind === "array" ? fromCells(cells(y).data.reverse()) : y;
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
    return a[idx.reduce((tot, ax, i) => tot * y.shape[i] + ax, 0)];
  });
  return A(sh, o);
});
export const iot = mf("⍳", "index generator", (err) => async (y) => {
  if (y.kind === "array" && y.shape.length === 1) {
    const sh = y.data.map((v) => {
      if (v.kind !== "number" || !Number.isInteger(v.data) || v.data < 0)
        throw err(
          `If ${omega} is a list it must only contain nonnegative integers`,
        );
      return v.data;
    });
    const o = indices(sh).map((v) => list(v.map(N)));
    return A(sh, o);
  }
  if (y.kind !== "number" || !Number.isInteger(y.data) || y.data < 0)
    throw err(`${omega} must be a nonnegative integer or a list thereof`);
  return range([y.data]);
});
export const len = mf("⧻", "length", () => async (y) => {
  return N(y.kind === "array" && y.shape.length > 0 ? y.shape[0] : 1);
});
export const sha = mf("△", "shape", () => async (y) => shape(y));
export const fla = mf("▽", "flat", () => async (y) => {
  return y.kind === "array" ? list(y.data) : list([y]);
});
export const enc = mf("□", "enclose", () => async (y) => A([], [y]));
export const enl = mf("⋄", "enlist", () => async (y) => A([1], [y]));
export const mer = mf("⊡", "merge", (err) => async (y) => {
  if (y.kind !== "array" || y.data.length === 0) return y;
  const [sh, ...shs] = y.data.map(shape);
  if (!(await asyncEvery(shs, async (v) => (await mat.def(v, sh)).data)))
    throw err("Cannot merge elements whose shapes do not match");
  const newsh = y.shape.concat(sh.data.map((x) => x.data as number));
  const dat = y.data.flatMap((x) => (x.kind === "array" ? x.data : x));
  return A(newsh, dat);
});
export const whe = mf("⊚", "where", (err) => async (y) => {
  if (y.kind === "number") y = A([1], [y]);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err(`${omega} must be a list`);
  return list(
    y.data.flatMap((v, i) => {
      if (v.kind !== "number") throw err(`${omega} can only contain numbers`);
      return Array(v.data).fill(N(i)) as Val[];
    }),
  );
});
export const gru = mf("⍋", "grade up", (err) => async (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err(`${omega} must be a list`);
  const d = y.data;
  const s = d.map((_, i) => i).sort((a, b) => compare(d[a], d[b]));
  return list(s.map(N));
});
export const grd = mf("⍒", "grade down", (err) => async (y) => {
  // if (y.kind !== "array" || y.shape.length < 1)
  //   throw err("Grade argument must have at least rank 1");
  // const { shape, data: d } = cells(y);
  if (y.kind !== "array" || y.shape.length !== 1)
    throw err(`${omega} must be a list`);
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
export const fmt = mf("⍕", "format", () => async (y) => {
  return list([...(await display(y))].map(C));
});
export const exc = mf("⍎", "execute", (err) => () => {
  throw err("unreachable");
});
export const ari = mf("⪫", "arity", () =>
  recur(async (ari, y) => {
    if (y.kind === "array" && y.shape.length > 0) return await each(ari, y);
    return N(y.kind === "function" ? y.arity : 0);
  }),
);

export const mem = df("∊", "member of", (err) => (x, y) => {
  if (y.kind !== "array" || y.shape.length < 1)
    throw err(`${omega} must have rank at least 1`);
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
export const par = df("⍮", "pair", () => async (x, y) => list([x, y]));
export const cat = df("⍪", "catenate", (err) =>
  recur(async (cat, x, y) => {
    if (x.kind === "array" && y.kind === "array") {
      const [xsh, ysh] = [x, y].map((v) => v.shape);
      if (xsh.length === ysh.length + 1) return cat(x, A([1, ...ysh], y.data));
      if (xsh.length + 1 === ysh.length) return cat(A([1, ...xsh], x.data), y);
      if (xsh.length !== ysh.length || !match(xsh.slice(1), ysh.slice(1)))
        throw err(`${alpha} and ${omega} must have matching cells`);
      const sh = [(xsh[0] ?? 1) + (ysh[0] ?? 1), ...xsh.slice(1)];
      return A(sh, x.data.concat(y.data));
    } else if (x.kind === "array") {
      const sh = [1, ...x.shape.slice(1)];
      const d = Array.from({ length: prod(sh) }, () => y);
      return cat(x, A(sh, d));
    } else if (y.kind === "array") {
      const sh = [1, ...y.shape.slice(1)];
      const d = Array.from({ length: prod(sh) }, () => x);
      return cat(A(sh, d), y);
    } else return list([x, y]);
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
  } else throw err(`${alpha} must be a valid shape`);
  const data = y.kind === "array" ? y.data : [y];
  const len = prod(sh);
  if (data.length === 0 && len !== 0)
    throw err("Cannot reshape empty array to non-empty array");
  const o = [];
  for (let i = 0; i < len; i++) o.push(data[i % data.length]);
  return A(sh, o);
});
export const rpl = df("⌿", "replicate", (err) => async (x, y) => {
  if (y.kind !== "array") throw err(`${omega} must be an array`);
  const cel = cells(y);
  const isOk = (v: Val) =>
    v.kind === "number" && v.data >= 0 && Number.isInteger(v.data);
  if (
    !isOk(x) &&
    (x.kind !== "array" || (x.shape.length !== 1 && !x.data.every(isOk)))
  )
    throw err(
      `${alpha} must be a nonnegative integer or nonnegative integer list`,
    );
  const amounts = (x.kind === "array" ? x.data : [x]).map(
    (v) => v.data as number,
  );
  if (amounts.length > cel.shape[0])
    throw err("Replicate amount may not be longer than array");
  const d = cel.data.flatMap((v, i) => {
    const l = amounts[i % amounts.length];
    return Array(l).fill(v) as Val[];
  });
  return fromCells(d);
});
export const sel = df("⊇", "select", (err) => async (x, y) => {
  if (y.kind !== "array") throw err(`${omega} must be an array`);
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
    if (y.kind !== "array") throw err(`${omega} must be an array`);
    if (x.kind === "number") return pick(A([1], [x]), y);
    else if (x.kind === "array") {
      if (x.shape.length !== 1 || !x.data.every((v) => v.kind === "number"))
        return each((i) => pick(i, y), x);
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
    } else throw err("Invalid indices to pick");
  }),
);
export const fil = df("⬚", "fill-merge", () => async (x, y) => {
  if (y.kind !== "array") return y;
  const sh: number[] = [];
  for (const v of y.data) {
    if (v.kind === "array") {
      const r = v.shape.length;
      for (let i = r - sh.length - 1; i >= 0; i--) sh.unshift(v.shape[i]);
      for (let i = 1; i <= r; i++)
        sh[sh.length - i] = Math.max(sh.at(-i) ?? 0, v.shape.at(-i)!);
    }
  }
  const idcs = indices(sh);
  const d: Val[] = [];
  for (let v of y.data) {
    if (v.kind !== "array") v = A([], [v]);
    const vsh = [...v.shape];
    while (vsh.length < sh.length) vsh.unshift(1);
    for (const idx of idcs) {
      if (idx.some((i, j) => i >= vsh[j])) d.push(x);
      else d.push(v.data[idx.reduce((tot, ax, i) => tot * vsh[i] + ax, 0)]);
    }
  }
  return A(y.shape.concat(sh), d);
});
const eachAxis = (
  err: (m: string) => Error,
  fn: (x: Extract<Val, { kind: "number" }>, y: Arr) => Promise<Val>,
) =>
  recur(async (g, x, y) => {
    if (y.kind !== "array") throw err(`${omega} must be an array`);
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
    } else throw err(`Invalid ${alpha}`);
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
      throw err(`Drop amount outside of bounds for length ${len}`);
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
    throw err(`${alpha} must be a list of numbers`);
  if (x.shape[0] !== len) throw err("Group arguments must have equal length");
  const buckets: Val[][] = [];
  for (let i = 0; i < len; i++) {
    const gi = x.data[i].data;
    if (gi > len || !Number.isInteger(gi))
      throw err("Group indices must be integers less than the array length");
    if (gi < 0) continue;
    while (buckets.length <= gi) buckets.push([]);
    buckets[gi].push(cel.data[i]);
  }
  return list(buckets.map(fromCells));
});
export const slf = mm("⍨", "self/const1", () => async (X) => {
  return F(1, X.kind === "function" ? (v) => X.data(v, v) : async () => X);
});
export const bac = mm("˜", "backward/const2", () => async (X) => {
  if (X.kind === "function" && X.arity === 1) return F(2, X.data);
  return F(2, X.kind === "function" ? (g, h) => X.data(h, g) : async () => X);
});
export const cel = mm("◡", "cells", () => (X) => rnk.def(X, N(-1)));
export const con = mm("⊙", "contents", (err) => async (X) => {
  if (X.kind !== "function") throw err(`${ualpha} must be a function`);
  return F(X.arity, (...v) =>
    X.data(
      ...v.map((z) =>
        z?.kind === "array" && z.shape.length === 0 ? z.data[0] : z,
      ),
    ),
  );
});
export const eac = mm("¨", "each", (err) => async (X) => {
  if (X.kind !== "function") throw err(`${ualpha} must be a function`);
  return F(X.arity, (...x) => each(X.data, ...x));
});
export const sca = mm("\\", "scan", (err, { err1 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err(`${ualpha} must be a dyadic function`);
  return F(1, async (y) => {
    if (y.kind !== "array" || y.shape.length < 1)
      throw err1(`${omega}'s rank must be at least 1'`);
    const cel = cells(y).data;
    const o = [cel[0]];
    for (let i = 1, acc = cel[0]; i < cel.length; i++)
      o.push((acc = await each(X.data, acc, cel[i])));
    return fromCells(o);
  });
});
export const red = mm("/", "reduce", (err, { err1 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err(`${ualpha} must be a dyadic function`);
  return F(1, async (y) => {
    if (y.kind !== "array") return y;
    if (y.data.length === 0) throw err1(`${omega} may not be empty`);
    const cel = cells(y);
    let acc = cel.data[0];
    for (let i = 1; i < cel.shape[0]; i++) acc = await X.data(acc, cel.data[i]);
    return acc;
  });
});
export const fol = mm("⫽", "fold", (err, { err2 }) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err(`${ualpha} must be a dyadic function`);
  return F(2, async (v, w) => {
    if (w.kind !== "array") throw err2(`${omega} must be an array`);
    const cel = cells(w);
    for (let i = 0; i < cel.shape[0]; i++) v = await X.data(v, cel.data[i]);
    return v;
  });
});
export const tab = mm("⊞", "table", (err) => async (X) => {
  if (X.kind !== "function" || X.arity !== 2)
    throw err(`${ualpha} must be a dyadic function`);
  return F(2, async (v, w) => {
    const sv = v.kind === "array" ? v.shape.slice(0, 1) : [];
    const sw = w.kind === "array" ? w.shape.slice(0, 1) : [];
    const shape = sv.concat(sw);
    const cv = cells(v);
    const cw = cells(w);
    const o: Val[] = [];
    for (const h of cv.data)
      for (const g of cw.data) o.push(await X.data(h, g));
    return mer.def(A(shape, o));
  });
});
export const win = mm("⊕", "windows", (err, { err1, err2 }) => async (X) => {
  if (X.kind !== "function") throw err(`${ualpha} must be a function`);
  if (X.arity === 2)
    return F(1, async (w) => {
      if (w.kind !== "array") throw err1(`${omega} must be an array`);
      const { data } = cells(w);
      const o: Val[] = [];
      for (let i = 0; i < data.length - 1; i++)
        o.push(await X.data(data[i], data[i + 1]));
      return fromCells(o);
    });
  else
    return F(2, async (v, w) => {
      if (w.kind !== "array") throw err2(`${omega} must be an array`);
      if (v.kind === "number") {
        const wn = v.data;
        const { data } = cells(w);
        const l = data.length;
        if (wn < 1 || !Number.isInteger(wn))
          throw err2(`${alpha} must be a positive integer`);
        if (wn > l) return A([0], []);
        const len = 1 + l - wn;
        const o = [];
        for (let i = 0; i < len; i++)
          o.push(await X.data(fromCells(data.slice(i, i + wn))));
        return fromCells(o);
      }
      throw err2(`${alpha} can only be a number for now`);
    });
});
export const rep = mm("↺", "repeat", (err, { err2 }) => async (X) => {
  if (X.kind !== "function") throw err(`${ualpha} must be a function`);
  const fn = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  return F(2, async (v, w) => {
    if (v.kind !== "number" || !Number.isInteger(v.data) || v.data < 0)
      throw err2(`${alpha} must be a nonnegative integer`);
    let cur = w;
    for (let i = 0; i < v.data; i++) {
      cur = await execnilad(await fn(N(i), cur));
    }
    return cur;
  });
});

export const ctc = dm("⎊", "catch", () => async (X, Y) => {
  if (X.kind !== "function") X = nilad(X);
  if (Y.kind !== "function") Y = nilad(Y);
  const arity = Math.max(X.arity, Y.arity);
  const [fX, fY] = [X, Y].map((v) =>
    arity === 2 && v.arity === 1 ? (_: Val, y: Val) => v.data(y) : v.data,
  );
  return F(arity, (...v) => fX(...v).catch(() => fY(...v)));
});
export const unt = dm("⍣", "until", (err, r) => async (X, Y) => {
  if (X.kind !== "function") throw err(`${ualpha} must be a function`);
  if (Y.kind !== "function" && Y.kind !== "number")
    throw err(`${uomega} must be a function or number`);
  const iter = X.arity === 2 ? X.data : (_: Val, v: Val) => X.data(v);
  const cond = Y.kind === "function" ? Y : F(1, async () => Y);
  const e = X.arity === 1 ? r.err1 : r.err2;
  const end = async (...v: Val[]) => {
    const r = await execnilad(await cond.data(...v));
    if (r.kind === "number" && (r.data === 0 || r.data === 1)) return r.data;
    throw e("Condition function must return a boolean");
  };
  const iterr = async (v: Val) =>
    e(`Maximum iteration count reached; last value:\n${await display(v)}`);
  const maxIter = 10000;
  if (cond.arity === 1)
    return F(X.arity, async (v, w) => {
      let g = X.arity === 1 ? v : w;
      for (let i = 0; !(await end(g)); i++) {
        if (i > maxIter) throw await iterr(g);
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
    throw await iterr(g);
  });
});
export const und = dm("⍢", "under", (err, r) => async (X, Y) => {
  if (
    X.kind !== "function" ||
    X.arity === 0 ||
    Y.kind !== "function" ||
    Y.arity === 0
  )
    throw err(`${ualpha} and ${uomega} must both be functions`);
  const arity = Math.max(X.arity, Y.arity);
  const e = arity === 1 ? r.err1 : r.err2;
  return F(arity, async (...v) => {
    const arr = v[arity - 1];
    const fn = X.arity === 1 ? X.data : (z: Val) => X.data(v[0], z);
    if (arr.kind !== "array") throw e(`${omega} must be an array`);
    const td = arr.data.map((d, i) => ({ ...d, i }));
    const tag = A(arr.shape, td);
    const sel = Y.arity === 1 ? await Y.data(tag) : await Y.data(v[0], tag);
    if ("i" in sel && typeof sel.i === "number") {
      const ins = await fn(sel);
      const dat = arr.data.map((d, i) => (i === sel.i ? ins : d));
      return A(arr.shape, dat);
    } else if (sel.kind === "array") {
      const untag = A(sel.shape, []);
      const idcs: number[] = [];
      for (const d of sel.data) {
        if ("i" in d && typeof d.i === "number") {
          if (idcs.includes(d.i))
            throw e(`${uomega} may not return duplicates`);
          idcs.push(d.i);
          untag.data.push(arr.data[d.i]);
        } else throw e(`${uomega} must only return items of ${omega}`);
      }
      const vals = await fn(untag);
      if (vals.kind !== "array" || !match(vals.shape, untag.shape))
        throw e(`${ualpha} must not change the shape of its input`);
      const dat = arr.data.map((d, i) => vals.data[idcs.indexOf(i)] ?? d);
      return A(arr.shape, dat);
    }
    throw e(`${ualpha} must return an item or an array of items from ${omega}`);
  });
});
export const rnk = dm("⍤", "rank", (err) => async (X, Y) => {
  Y = await execnilad(Y);
  if (X.kind !== "function") throw err(`${ualpha} must be function`);
  if (Y.kind === "number") Y = A([1], [Y]);
  if (Y.kind !== "array" || Y.shape.length !== 1 || Y.shape[0] === 0)
    throw err(`${uomega} must be a number or non-empty list`);
  const r = Y.data.map((v) => {
    if (
      v.kind !== "number" ||
      (!Number.isInteger(v.data) && Number.isFinite(v.data))
    )
      throw err(`${uomega} may only contain integers or infinity`);
    return v.data;
  });
  return F(X.arity, async (...xs: Val[]) => {
    const cs = xs.map((y, i) => cells(y, r[i] ?? r[0]));
    return mer.def(await each(X.data, ...cs));
  });
});
export const cho = dm("◶", "choose", (err, r) => async (X, Y) => {
  if (X.kind !== "array" || X.shape.length !== 1)
    throw err(`${ualpha} must be a list`);
  if (Y.kind !== "function") throw err(`${uomega} must be a function`);
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
  if (Y.kind !== "function" || Y.arity === 0)
    throw err(`${uomega} must be a function`);
  X = await execnilad(X);
  if (Y.arity === 1) return aft.def(Y, X);
  const l = X.kind === "function" ? X : F(1, async () => X);
  return F(l.arity, async (v, w) =>
    Y.data(await l.data(v, w), l.arity === 1 ? v : w),
  );
});
export const aft = dm("⟜", "after", (err) => async (X, Y) => {
  if (X.kind !== "function" || X.arity === 0)
    throw err(`${ualpha} must be a function`);
  Y = await execnilad(Y);
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
    throw err(`${ualpha} and ${uomega} must both be functions`);
  if (X.arity !== 2) throw err(`${ualpha} must be dyadic`);
  return F(2, async (v, w) =>
    Y.arity === 1
      ? X.data(await Y.data(v), await Y.data(w))
      : X.data(await Y.data(w, v), await Y.data(v, w)),
  );
});

export const lft = df("⊣", "left argument", () => async (x) => x);
export const rgt = df("⊢", "right argument", () => async (_, y) => y);
export const id = mf("⋅", "identity", () => async (y) => y);
export const sb = mm("₀", "subject", () => async (X) => {
  const val = execnilad(X);
  return F(0, () => val);
});
export const mn = mm("₁", "monad", (err) => async (X) => {
  X = await execnilad(X);
  if (X.kind !== "function") return F(1, async () => X);
  if (X.arity === 2) throw err("Cannot coerce dyad to monad");
  return X;
});
export const dy = mm("₂", "dyad", () => async (X) => {
  X = await execnilad(X);
  if (X.kind !== "function") return F(2, async () => X);
  if (X.arity === 1) return F(2, (_, y) => X.data(y));
  return X;
});

export const inf = ct("∞", "infinity", () => N(Infinity));
export const pi = ct("π", "pi", () => N(Math.PI));
export const tau = ct("τ", "tau", () => N(Math.PI * 2));
export const emp = ct("⍬", "empty vector", () => A([0], []));
