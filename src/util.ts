export function match(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
export type Val =
  | { kind: "character"; data: number }
  | { kind: "number"; data: number }
  | { kind: "array"; shape: number[]; data: Val[] }
  | {
      kind: "function";
      arity: number;
      data: Fn;
      repr?: string;
    };
type Fn = (...x: Val[]) => Promise<Val>;
export const F = (arity: number, data: Fn, repr?: string) =>
  ({
    kind: "function",
    arity,
    data,
    repr,
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
export { display } from "./primitives";
export const range = (shape: number[]): Val =>
  A(
    shape,
    Array(shape.reduce((a, b) => a * b))
      .fill(0)
      .map((_, i) => N(i)),
  );
export function indices(sh: number[]) {
  const len = sh.reduce((a, b) => a * b, 1);
  const o: number[][] = [];
  for (let ind = 0; ind < len; ind++) {
    let i = ind;
    const x = [...sh]
      .reverse()
      .map((ax) => {
        const j = i % ax;
        i = Math.floor(i / ax);
        return j;
      })
      .reverse();
    o.push(x);
  }
  return o;
}
export const execnilad = async (v: Val): Promise<Val> =>
  v.kind === "function" && v.arity === 0 ? execnilad(await v.data()) : v;

export const list = (arr: Val[]) => A([arr.length], arr);
export function fromCells(arr: Val[]) {
  const isA = arr[0].kind === "array";
  const sh = isA ? (arr[0] as Val & { kind: "array" }).shape : [];
  const d = arr.flatMap((v) => {
    if (!isA && v.kind !== "array") return v;
    if (isA && v.kind === "array" && match(sh, v.shape)) return v.data;
    throw new Error("Cannot construct array from cells whose shapes differ");
  });
  return A([arr.length, ...sh], d);
}
export async function asyncMap<U, T>(
  arr: U[],
  fn: (v: U, i: number) => Promise<T>,
) {
  const d: T[] = [];
  for (let i = 0; i < arr.length; i++) d.push(await fn(arr[i], i));
  return d;
}
export async function asyncEvery<T>(
  arr: T[],
  fn: (v: T, i: number) => unknown,
) {
  for (let i = 0; i < arr.length; i++) if (!(await fn(arr[i], i))) return false;
  return true;
}
export async function map(
  fn: (...v: Val[]) => Promise<Val>,
  ...arrs: (Val & { kind: "array" })[]
) {
  const shape = arrs[0].shape;
  const d = await asyncMap(arrs[0].data, (v, i) => fn(v, arrs[1]?.data[i]));
  return A(shape, d);
}
export async function each(fn: Fn, ...v: Val[]): Promise<Val> {
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
        const d = await asyncMap(cy.data, (v, i) =>
          fn(x.data[i] ?? x.data[0], v),
        );
        return A(cy.shape, d);
      } else {
        const cx = cells(x, -m);
        const d = await asyncMap(cx.data, (v, i) =>
          fn(v, y.data[i] ?? y.data[0]),
        );
        return A(cx.shape, d);
      }
    }
    const d = await asyncMap(x.data, (v) => fn(v, y));
    return A(x.shape, d);
  } else if (y?.kind === "array") {
    const d = await asyncMap(y.data, (v) => fn(x, v));
    return A(y.shape, d);
  } else return fn(x, y);
}
export function cells(arr: Val, r = -1) {
  if (arr.kind !== "array") return A([], [arr]);
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

export function recur(fn: (g: Fn, ...xs: Val[]) => Promise<Val>) {
  return function g(...xs: Val[]) {
    return fn(g, ...xs);
  };
}
export function pervasive(fn: (...xs: Atom[]) => Promise<Val>) {
  return recur((g, ...xs) =>
    xs.every((v) => v?.kind !== "array") ? fn(...xs) : each(g, ...xs),
  );
}

export function vToImg(y: Val) {
  let dat: number[];
  if (y.kind !== "array" || !y.data.every((v) => v.kind === "number"))
    return false;
  if (y.shape.length === 2) {
    dat = y.data.flatMap((v) => {
      const b = Math.round(v.data * 255);
      return [b, b, b, 255];
    });
  } else if (y.shape.length === 3) {
    const lastAxis = y.shape[2];
    if (lastAxis < 2 || lastAxis > 4) return false;
    const col = cells(y, 1) as Arr<Arr<Num>>;
    dat = col.data.flatMap((v) => {
      const w = v.data.map((v) => Math.round(v.data * 255));
      if (lastAxis === 2) return [w[0], w[0], w[0], w[1]];
      if (lastAxis === 3) return [...w, 255];
      return w;
    });
  } else return false;
  const colors = new Uint8ClampedArray(dat);
  return new ImageData(colors, y.shape[1], y.shape[0]);
}

export function isString(
  y: Val,
): y is Arr<Extract<Val, { kind: "character" }>> {
  return (
    y.kind === "array" &&
    y.data.every((v) => v.kind === "character") &&
    y.shape.length === 1
  );
}

export type Atom = Exclude<Val, { kind: "array" }>;
export type Arr<T extends Val = Val> = {
  kind: "array";
  shape: number[];
  data: T[];
};
export type Num = Extract<Val, { kind: "number" }>;
