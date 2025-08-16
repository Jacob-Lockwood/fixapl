import { quad } from "./glyphs";
import { ReplContext } from "./lang";
import { A, Arr, C, F, isString, list, N, Num, Val, vToImg } from "./util";

// export const quadsList = new Map<string, number>();
// ?! WHY DOESN'T IT JUST WORK ARGHH
// TODO figure out why it stopped working and stop hardcoding this
export const quadsList = new Map([
  ["Print", 1],
  ["Prompt", 1],
  ["Sleep", 1],
  ["Img", 1],
  ["Text", 2],
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
      if (!isString(y)) throw err("y must be a string");
      const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
      ctx.write(s + "\n");
      return y;
    }),
    q("Prompt", 1, (err) => async (y) => {
      if (!isString(y)) throw err("y must be a string");
      const s = String.fromCodePoint(...y.data.map((x) => x.data));
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
      if (y.shape.includes(0)) throw err("No axis of y may be 0");
      ctx.drawImage(vToImg(y) as ImageData);
      return A([0], []);
    }),
    q("Text", 2, (err) => async (x, y) => {
      if (!isString(y)) throw err("y must be a string");
      const s = String.fromCodePoint(...y.data.map((v) => v.data));
      let fontSize: number;
      let fontFamily: string | undefined;
      let bg: number[] | undefined;
      let color: number[] | undefined;
      if (x.kind === "number" && x.data > 0) {
        fontSize = x.data;
      } else if (x.kind === "array" && x.shape.length === 1) {
        let features = 1;

        const fs = x.data.find((v) => v.kind === "number");
        if (!fs) throw err("x must specify a font size");
        if (fs.data < 0) throw err("Font size must be positive");
        fontSize = fs.data;

        const ff = x.data.find(isString);
        if (ff) {
          features++;
          fontFamily = String.fromCodePoint(...ff.data.map((x) => x.data));
        }
        const colors = x.data.filter(
          (v): v is Arr<Num> =>
            v.kind === "array" &&
            v.shape.length === 1 &&
            v.shape[0] < 5 &&
            v.shape[0] > 2 &&
            v.data.every((v) => v.kind === "number"),
        );
        if (colors[0]) color = colors[0].data.map((v) => v.data);
        if (colors[1]) bg = colors[1].data.map((v) => v.data);
        features += colors[0] ? (colors[1] ? 2 : 1) : 0;

        if (x.shape[0] !== features)
          throw err(`x contains ${x.shape[0] - features} invalid member(s)`);
      } else throw err("x must be a positive number or a list");

      const { width, height, data } = await ctx.drawText({
        fontSize,
        fontFamily,
        color,
        bg,
        text: s,
      });
      return A(
        [height, width, 4],
        [...data].map((v) => N(v / 255)),
      );
    }),
  ]);
