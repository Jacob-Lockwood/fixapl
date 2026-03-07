#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { createInterface } from "readline/promises";
import { text } from "stream/consumers";
import { argv, cwd, exit, stdin, stdout } from "process";
import { resolve } from "path";
import kleur from "kleur";

import { lex, Parser, Token, Visitor } from "./lang";
import { execnilad, Val } from "./util";
import pretty from "./pretty";

import { version } from "../package.json";
import { quadsList } from "./quads";
const verStr = `FIXAPL v${version}`;

const rl = createInterface({ input: stdin, output: stdout }).pause();
const erase = (s: string) => {
  const h = Math.ceil(s.length / stdout.getWindowSize()[0]);
  stdout.moveCursor(0, -h);
  stdout.clearScreenDown();
};
const fmt = (s: string) =>
  lex(s)
    .map((x) => x.image)
    .join("");
const bdg: Record<string, number> = {};
const highlight = (tks: Token[]) =>
  tks
    .map(({ kind, image }) => {
      let style = kleur.white;
      const ba = kind === "identifier" ? (bdg[image] ?? 0) : 0;
      const qa = kind === "quad" ? (quadsList.get(image.slice(1)) ?? 0) : 0;
      if (kind === "monadic function" || ba === 1 || qa === 1)
        style = kleur.green;
      if (kind === "dyadic function" || ba === 2 || qa === 2)
        style = kleur.blue;
      if (kind === "monadic modifier") style = kleur.yellow;
      if (kind === "dyadic modifier") style = kleur.magenta;
      if (kind === "string" || kind === "character") style = kleur.cyan;
      if (kind === "number" || kind === "constant" || kind.includes("dfn arg"))
        style = kleur.red;
      if (kind === "comment") style = kleur.gray().italic;
      return style(image);
    })
    .join("");
const v = new Visitor({
  write: (s) => stdout.write(s),
  read: () => {
    rl.resume();
    return new Promise((res) =>
      rl.once("line", (s) => {
        rl.pause();
        res(s);
      }),
    );
  },
});
async function run(s: string) {
  const t = lex(s).filter((t) => !"whitespace,comment".includes(t.kind));
  rl.pause();
  const p = new Parser(t).program();
  const o: Val[] = [];
  for (const x of p) {
    const r = await v.visit(x);
    if (x.kind === "binding") bdg[x.name] = r.kind === "function" ? r.arity : 0;
    else o.push(await execnilad(r));
  }
  return o;
}

const read = (p: string) => readFile(resolve(cwd(), p), "utf8");

if (["-v", "--version"].includes(argv[2])) console.log(version);
else if (["-h", "--help", "help"].includes(argv[2])) {
  console.log(`${verStr}
${"-".repeat(verStr.length)}
REPL:    fixapl
run:     fixapl file.fxapl    or    fixapl run [file]   
format:  fixapl fmt [file]
options: -h = --help, -v = --version
update:  npm i -g fixapl`);
}
if (argv[2]?.endsWith(".fxapl"))
  run(await readFile(resolve(cwd(), argv[2]), "utf8"));
else if (argv[2] === "run") {
  await run(argv[3] ?? (await text(stdin)));
} else if (argv[2] === "fmt") {
  if (!argv[3]) console.log(fmt(await text(stdin)));
  else await writeFile(argv[3], fmt(await read(argv[3])));
} else {
  console.log(`${verStr} REPL\n^C to close`);
  while (true) {
    const prompt = "        ";
    const line = await rl.question(prompt).catch(() => exit(0));
    try {
      rl.pause();
      const tk = lex(line);
      const f = tk.map((k) => k.image).join("");
      erase(prompt + line);
      console.log(prompt + f);
      const t = tk.filter((t) => !"whitespace,comment".includes(t.kind));
      const x = new Parser(t).program()[0];
      const r = await v.visit(x);
      if (x.kind === "binding")
        bdg[x.name] = r.kind === "function" ? r.arity : 0;
      erase(prompt + f);
      console.log(prompt + highlight(tk));
      if (x.kind !== "binding")
        console.log((await pretty(await execnilad(r))).join("\n"));
    } catch (e) {
      console.error(e);
    }
  }
}
