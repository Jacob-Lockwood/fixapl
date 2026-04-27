import { quad, alpha, omega } from "./glyphs";
import { Backend } from "./lang";
import pretty from "./pretty";
import {
  A,
  Arr,
  C,
  F,
  graphemes,
  isString,
  list,
  N,
  Num,
  Val,
  vToImg,
} from "./util";

export const quadsList = new Map<string, number>();

const qdefs = new Map<string, (ctx: Partial<Backend>) => Val>();
const q = (
  name: string,
  arity: number,
  def: (
    ctx: Partial<Backend>,
    err: (m: string) => Error,
  ) => (...args: Val[]) => Promise<Val>,
) => {
  quadsList.set(name, arity);
  const msg = (arity === 2 ? alpha + " " : "") + quad + name + ` ${omega}: `;
  qdefs.set(name, (ctx) => {
    const d = def(ctx, (m) => new Error(msg + m));
    return F(arity, d, quad + name);
  });
};
q("P", 1, (ctx, err) => async (y) => {
  if (!ctx.write)
    throw err("writing to the console is not supported in this environment");
  if (!isString(y)) throw err(`${omega} must be a string`);
  const s = y.data.map((x) => String.fromCodePoint(x.data)).join("");
  ctx.write(s + "\n");
  return y;
});
q("S", 1, (ctx, err) => async (y) => {
  if (!ctx.write)
    throw err("writing to the console is not supported in this environment");
  ctx.write((await pretty(y)).join("\n") + "\n");
  return y;
});
q("Prompt", 1, (ctx, err) => async (y) => {
  if (!ctx.write)
    throw err("writing to the console is not supported in this environment");
  if (!ctx.read)
    throw err("reading from the console is not supported in this environment");
  if (!isString(y)) throw err(`${omega} must be a string`);
  const s = String.fromCodePoint(...y.data.map((x) => x.data));
  ctx.write(s);
  const o = await ctx.read();
  if (o === null) throw err("no input was provided");
  return list(graphemes(o).map(C));
});
q("Sleep", 1, (_, err) => async (y) => {
  if (y.kind !== "number") throw err(`${omega} must be a number`);
  const t1 = Date.now();
  await new Promise((res) => setTimeout(res, y.data * 1000));
  return N((Date.now() - t1) / 1000);
});
q("Img", 1, (ctx, err) => async (y) => {
  if (!ctx.drawImage)
    throw err("drawing images is not supported in this environment");
  if (y.kind !== "array" || !y.data.every((v) => v.kind === "number"))
    throw err(`${omega} must be an array of numbers`);
  if (y.shape.length < 2 || y.shape.length > 3)
    throw err(`${omega} must have rank 2 or 3`);
  if ((y.shape.length === 3 && y.shape[2] > 4) || y.shape[2] < 2)
    throw err(`If ${omega} has rank 3, its last axis must be 2, 3, or 4`);
  if (y.shape.includes(0)) throw err(`No axis of ${omega} may be 0`);
  ctx.drawImage(vToImg(y) as ImageData);
  return A([0], []);
});
q("Text", 2, (ctx, err) => async (x, y) => {
  if (!ctx.drawText)
    throw err("drawing text is not supported in this environment");
  if (!isString(y)) throw err(`${omega} must be a string`);
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
    if (!fs) throw err(`${omega} must specify a font size`);
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
      throw err(`${alpha} contains ${x.shape[0] - features} invalid member(s)`);
  } else throw err(`${alpha} must be a positive number or a list`);

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
});
q("File", 1, (ctx, err) => async (y) => {
  if (!ctx.readFile)
    throw err("reading files is not supported in this environment");
  if (!isString(y)) throw err(`${omega} must be a string`);
  const s = String.fromCodePoint(...y.data.map((v) => v.data));
  try {
    return list(graphemes(await ctx.readFile(s)).map(C));
  } catch (e) {
    throw err(e instanceof Error ? e.message : e + "");
  }
});
export default (ctx: Partial<Backend>) =>
  new Map([...qdefs.entries()].map(([name, def]) => [name, def(ctx)]));
