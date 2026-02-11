import { lex, Parser, TextOptions, Token, Visitor } from "./lang";
import pretty from "./pretty";
import { Arr, display, execnilad, Num, vToImg } from "./util";

export type MessageIn =
  | ["eval", string, { autoImg: boolean; pretty: boolean }]
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
      if (n.kind === "binding") continue;
      const img = settings.autoImg && vToImg(v);
      if (img && bigEnough(v as Arr<Num>)) msg(["image", img]);
      else {
        const r = settings.pretty
          ? (await pretty(v)).join("\n")
          : await display(v);
        msg(["result", r]);
      }
      const bindings = new Map([
        ...visitor.scopes.flatMap((scope) =>
          [...scope.keys()].map((name) => [name, 0] as const),
        ),
        ...[...visitor.bindings.entries()].map(
          ([name, val]) =>
            [name, val.kind === "function" ? val.arity : 0] as const,
        ),
      ]);
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
