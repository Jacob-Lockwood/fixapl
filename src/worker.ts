import { lex, Parser, Token, Visitor } from "./lang";
import { display, execnoad } from "./util";

export type MessageIn = ["eval", string] | ["input", string | null];
export type MessageOut =
  | ["tokens", Token[]]
  | ["result", string]
  | ["error", unknown]
  | ["bindings", Map<string, number>]
  | ["time", number]
  | ["write", string]
  | ["image", ImageData]
  | ["read"];
const msg = (d: MessageOut) => postMessage(d);

const visitor = new Visitor({
  write: (s) => postMessage(["write", s]),
  read: () => {
    postMessage(["read"]);
    return new Promise<string | null>((resolve) => {
      inputSubscriber = resolve;
    });
  },
  drawImage: (d) => postMessage(["image", d]),
});
let inputSubscriber: (v: string | null) => void;

onmessage = async ({ data: [kind, source] }: MessageEvent<MessageIn>) => {
  if (kind === "input") return inputSubscriber(source);
  const t = Date.now();
  try {
    const toks = lex(source);
    msg(["tokens", toks]);
    const t = toks.filter((x) => !"whitespace,comment".includes(x.kind));
    const p = new Parser(t).program();
    for (const n of p) {
      const v = await execnoad(await visitor.visit(n));
      msg(["result", display(v)]);
      msg([
        "bindings",
        new Map(
          [...visitor.bindings.entries()].map((z) => [
            z[0],
            z[1].kind === "function" ? z[1].arity : 0,
          ]),
        ),
      ]);
    }
  } catch (e) {
    msg(["error", e]);
  }
  msg(["time", Date.now() - t]);
};
