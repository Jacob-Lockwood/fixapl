import { quad } from "./glyphs";
import { ReplContext } from "./lang";
import { A, C, F, list, N, Val, vToImg } from "./util";

// export const quadsList = new Map<string, number>();
// ?! WHY DOESN'T IT JUST WORK ARGHH
// TODO figure out why it stopped working and stop hardcoding this
export const quadsList = new Map([
  ["Print", 1],
  ["Prompt", 1],
  ["Sleep", 1],
  ["Img", 1],
]);

const q = (
  name: string,
  arity: number,
  def: (err: (m: string) => Error) => (...args: Val[]) => Promise<Val>,
) => {
  // quadsList.set(name, arity);
  const msg = (arity === 2 ? "x " : "") + quad + name + " y: ";
  const dat = def((m) => new Error(msg + m));
  return [name, F(arity, dat, quad + name)] as const;
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
    q("Img", 1, (err) => async (y) => {
      if (y.kind !== "array" || !y.data.every((v) => v.kind === "number"))
        throw err("y must be an array of numbers");
      if (y.shape.length < 2 || y.shape.length > 3)
        throw err("y must have rank 2 or 3");
      if ((y.shape.length === 3 && y.shape[2] > 4) || y.shape[2] < 2)
        throw err("If y has rank 3, its last axis must be 2, 3, or 4");
      ctx.drawImage(vToImg(y) as ImageData);
      return A([0], []);
    }),
  ]);
