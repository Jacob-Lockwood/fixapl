import { quad } from "./glyphs";
import { ReplContext } from "./lang";
import { A, Arr, C, cells, F, list, N, Num, Val } from "./util";

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
    q("Img", 1, (err) => async (y) => {
      if (y.kind !== "array" || !y.data.every((v) => v.kind === "number"))
        throw err("y must be an array of numbers");
      let dat: number[];
      if (y.shape.length === 2) {
        dat = y.data.flatMap((v) => {
          const b = Math.round(v.data * 255);
          return [b, b, b, 255];
        });
      } else if (y.shape.length === 3) {
        const col = cells(y, 1) as Arr<Arr<Num>>;
        dat = col.data.flatMap((v) => {
          const w = v.data.map((v) => Math.round(v.data * 255));
          if (w.length === 2) return [w[0], w[0], w[0], w[1]];
          if (w.length === 3) return [...w, 255];
          if (w.length === 4) return w;
          throw err("If y has rank 3, its last axis must be 2, 3, or 4");
        });
      } else throw err("y must have rank 2 or 3");
      const colors = new Uint8ClampedArray(dat);
      const img = new ImageData(colors, y.shape[1], y.shape[0]);
      ctx.drawImage(img);
      return A([0], []);
    }),
  ]);
