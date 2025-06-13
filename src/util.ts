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
