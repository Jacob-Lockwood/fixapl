export function match(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
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
export { display } from "./primitives";
export const range = (shape: number[]): Val =>
  A(
    shape,
    Array(shape.reduce((a, b) => a * b))
      .fill(0)
      .map((_, i) => N(i)),
  );
export const execnoad = (v: Val): Val =>
  v.kind === "function" && v.arity === 0 ? execnoad(v.data()) : v;

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
export function map(
  fn: (...v: Val[]) => Val,
  ...arrs: (Val & { kind: "array" })[]
) {
  const shape = arrs[0].shape;
  const d = arrs[0].data.map((v, i) => fn(v, arrs[1]?.data[i]));
  return A(shape, d);
}
export function each(fn: (...x: Val[]) => Val, ...v: Val[]): Val {
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
export function cells(arr: Val, r = -1) {
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
