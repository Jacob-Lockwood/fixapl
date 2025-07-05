import { lex, Parser, TextOptions, Token, Visitor } from "./lang";
import { Arr, display, execnilad, Num, vToImg } from "./util";

export type MessageIn =
  | ["eval", string, { autoImg: boolean }]
  | ["input", string | null]
  | ["text", ImageData];
export type MessageOut =
  | ["tokens", Token[]]
  | ["result", string]
  | ["error", unknown]
  | ["bindings", Map<string, number>]
  | ["time", number]
  | ["write", string]
  | ["image", ImageData]
  | ["text", TextOptions]
  | ["read"];
const msg = (d: MessageOut) => postMessage(d);

const visitor = new Visitor({
  write: (s) => postMessage(["write", s]),
  read: () => {
    msg(["read"]);
    return new Promise<string | null>((resolve) => {
      inputSubscriber = resolve;
    });
  },
  drawImage: (d) => postMessage(["image", d]),
  drawText: (opts) => {
    msg(["text", opts]);
    return new Promise<ImageData>((resolve) => {
      textSubscriber = resolve;
    });
  },
});
let inputSubscriber: (v: string | null) => void;
let textSubscriber: (v: ImageData) => void;

onmessage = async ({
  data: [kind, data, settings],
}: MessageEvent<MessageIn>) => {
  if (kind === "input") return inputSubscriber(data);
  if (kind === "text") return textSubscriber(data);
  const t = Date.now();
  try {
    const toks = lex(data);
    msg(["tokens", toks]);
    const t = toks.filter((x) => !"whitespace,comment".includes(x.kind));
    const p = new Parser(t).program();
    for (const n of p) {
      const v = await execnilad(await visitor.visit(n));
      const img = settings.autoImg && vToImg(v);
      if (img && bigEnough(v as Arr<Num>)) msg(["image", img]);
      else msg(["result", await display(v)]);
      const bindings = new Map(
        [...visitor.bindings.entries()].map((z) => [
          z[0],
          z[1].kind === "function" ? z[1].arity : 0,
        ]),
      );
      msg(["bindings", bindings]);
    }
  } catch (e) {
    msg(["error", e]);
  }
  msg(["time", Date.now() - t]);
};

function bigEnough(v: Arr<Num>) {
  return v.shape[0] >= 30 && v.shape[1] >= 30;
}
