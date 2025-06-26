import { quad } from "./glyphs";
import { ReplContext } from "./lang";
import { A, C, F, list, N, Val } from "./util";

export const quadsList = new Map<string, number>();
const q = (
  name: string,
  arity: number,
  def: (err: (m: string) => Error) => (...args: Val[]) => Promise<Val>,
) => {
  quadsList.set(name, arity);
  const msg = (arity === 2 ? "x " : "") + quad + name + " y: ";
  const dat = def((m) => new Error(msg + m));
  return [name, F(arity, dat)] as const;
};
export default (ctx: ReplContext) =>
  new Map([
    q("Print", 1, (err) => async (y) => {
      if (
        y.kind !== "array" ||
        y.shape.length !== 1 ||
        !y.data.every((v) => v.kind === "character")
      )
        throw err("y must be a string");
      const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
      return ctx.write(s + "\n"), A([0], []);
    }),
    q("Prompt", 1, (err) => async (y) => {
      if (
        y.kind !== "array" ||
        y.shape.length !== 1 ||
        !y.data.every((v) => v.kind === "character")
      )
        throw err("y must be a string");
      const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
      ctx.write(s);
      const o = await ctx.read();
      if (o === null) throw err("no input was provided");
      ctx.write(o + "\n");
      return list([...o].map(C));
    }),
    q("Sleep", 1, (err) => async (y) => {
      if (y.kind !== "number") throw err("y must be a number");
      const t1 = Date.now();
      await new Promise((res) => setTimeout(res, y.data * 1000));
      return N((Date.now() - t1) / 1000);
    }),
  ]);
