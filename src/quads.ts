import { quad } from "./glyphs";
import { ReplContext } from "./lang";
import { A, C, F, list, Val } from "./util";

export const quadsList = new Map<string, number>();
const q = (
  name: string,
  arity: number,
  def: (err: (m: string) => Error) => (...args: Val[]) => Val,
) => {
  quadsList.set(name, arity);
  const msg = (arity === 2 ? "X " : "") + quad + name + " Y: ";
  const dat = def((m) => new Error(msg + m));
  return [name, F(arity, dat)] as const;
};
export default (ctx: ReplContext) =>
  new Map([
    q("Print", 1, (err) => (y) => {
      if (
        y.kind !== "array" ||
        y.shape.length !== 1 ||
        !y.data.every((v) => v.kind === "character")
      )
        throw err("y must be a string");
      const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
      return ctx.write(s + "\n"), A([0], []);
    }),
    q("Prompt", 1, (err) => (y) => {
      if (
        y.kind !== "array" ||
        y.shape.length !== 1 ||
        !y.data.every((v) => v.kind === "character")
      )
        throw err("y must be a string");
      const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
      ctx.write(s);
      const o = ctx.read();
      if (o === null) throw err("no input was provided");
      ctx.write(o + "\n");
      return list([...o].map(C));
    }),
  ]);
