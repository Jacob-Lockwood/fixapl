#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { emitKeypressEvents, Key } from "readline";
import { text } from "stream/consumers";
import { argv, cwd, exit, stdin, stdout } from "process";
import { dirname, resolve } from "path";
import kleur from "kleur";

import { lex, Parser, Token, Visitor } from "./lang";
import { execnilad, Val } from "./util";
import pretty from "./pretty";
import { quadsList } from "./quads";
import keyboard from "./keyboard.json";

import { version } from "../package.json";
const verStr = `FIXAPL v${version}`;

const erase = (lines: number) => {
  stdout.moveCursor(0, -lines);
  stdout.clearScreenDown();
};
const prompt = "".padEnd(8);
const w = () => stdout.getWindowSize()[0] - prompt.length - 1;
const h = (s: string) => Math.floor(s.length / w()) + 1;
const fmt = (s: string) =>
  lex(s)
    .map((x) => x.image)
    .join("")
    .trimEnd();
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
let root = cwd();
const v = new Visitor({
  write: (s) => stdout.write(s),
  read: () =>
    new Promise<string>((resolve) => {
      if (stdin.isTTY) stdin.setRawMode(true);
      emitKeypressEvents(stdin);
      let s = "";
      let col = 0;
      const resolveline = (s: string) => {
        stdin.removeListener("keypress", keypress);
        process.removeListener("SIGINT", sigint);
        resolve(s);
      };
      const sigint = () => {
        (resolveline(""), exit());
      };
      process.on("SIGINT", sigint);
      const keypress = (chunk: string, key?: Key) => {
        if (key?.ctrl && key.name === "c") return (resolveline(""), exit());
        if (key?.name === "backspace") {
          if (col <= 0) return;
          s = s.slice(0, col - 1) + s.slice(col);
          col--;
          stdout.moveCursor(-1, 0);
          stdout.clearLine(1);
          stdout.write(s.slice(col));
          stdout.moveCursor(col - s.length, 0);
        } else if (key?.name === "return") {
          stdout.write("\n");
          return resolveline(s);
        } else if (key?.name === "left") {
          if (col <= 0) return;
          col--;
          stdout.moveCursor(-1, 0);
        } else if (key?.name === "right") {
          if (col >= s.length) return;
          col++;
          stdout.moveCursor(1, 0);
        } else {
          s = s.slice(0, col) + chunk + s.slice(col);
          stdout.clearLine(1);
          stdout.write(s.slice(col));
          stdout.moveCursor(col - s.length + 1, 0);
          col += chunk.length;
        }
      };
      stdin.on("keypress", keypress);
    }),
  readFile: (p) => readFile(resolve(root, p), "utf8"),
});
async function run(s: string) {
  const t = lex(s).filter((t) => !"whitespace,comment".includes(t.kind));
  const p = new Parser(t).program();
  const o: Val[] = [];
  for (const x of p) o.push(await execnilad(await v.visit(x)));
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
} else if (argv[2] === "run" || argv[2]?.endsWith(".fxapl")) {
  const isRun = argv[2] === "run";
  const fileArg = isRun ? argv[3] : argv[2];
  if (fileArg) root = dirname(fileArg);
  await run(fileArg ? await read(fileArg) : await text(stdin));
  exit(0);
} else if (argv[2] === "fmt") {
  if (!argv[3]) stdout.write(fmt(await text(stdin)));
  else await writeFile(argv[3], fmt(await read(argv[3])) + "\n");
} else {
  console.log(`${verStr} REPL\n^C to close`);
  const history: string[] = [];
  let historyPos = -1;
  if (stdin.isTTY) stdin.setRawMode(true);
  emitKeypressEvents(stdin);
  const question = () =>
    new Promise<string>((resolve) => {
      historyPos = -1;
      let s = "";
      const str = () => history[historyPos] ?? s;
      let rowprv = 0;
      let row = 0;
      let col = 0;
      const pos = () => w() * row + col;
      const mov = (n: number) => {
        col += n;
        if (col > w()) {
          col = col % w();
          row++;
        } else if (col < 0 && row > 0) {
          col = w() - col;
          row--;
        } else if (col < 0) {
          col = 0;
        }
        if (row * w() + col > str().length) col = str().length % w();
      };
      const ins = (c: string) => {
        if (historyPos != -1) s = history[historyPos];
        historyPos = -1;
        if (!c) return;
        s = s.slice(0, pos()) + c + s.slice(pos());
        mov(c.length);
      };
      const overwrite = () => {
        stdout.cursorTo(0);
        stdout.moveCursor(0, -rowprv);
        stdout.clearScreenDown();
        for (let i = 0; i < h(str()); i++) {
          stdout.write(i === 0 ? prompt : "...".padEnd(prompt.length));
          stdout.write(str().slice(i * w(), (i + 1) * w()) + "\n");
        }
        stdout.moveCursor(prompt.length + col, row - h(str()));
        rowprv = row;
      };
      overwrite();
      const resolveline = (s: string) => {
        stdin.removeListener("keypress", keypress);
        process.removeListener("SIGINT", sigint);
        resolve(s);
      };
      const sigint = () => {
        console.log("received SIGINT");
        resolveline("") ?? exit();
      };
      process.on("SIGINT", sigint);
      let tabEntered = false;
      const keypress = (chunk: string, key?: Key) => {
        if (key?.ctrl && key.name === "c") return resolveline("") ?? exit();
        if (tabEntered) {
          tabEntered = false;
          if (chunk in keyboard) {
            ins(keyboard[chunk as keyof typeof keyboard]);
          } else if (key?.name !== "return") ins(chunk);
        } else if (key?.name === "tab") {
          tabEntered = true;
        } else if (key?.name === "backspace") {
          s = s.slice(0, pos() - 1) + s.slice(pos());
          mov(-1);
        } else if (chunk === "\u0015") {
          // ctrl+backspace; delete before cursor
          s = s.slice(pos());
          row = col = 0;
        } else if (key?.name === "return") {
          ins("");
          stdout.write("\n");
          return resolveline(s);
        } else if (key?.name === "left") {
          mov(-1);
        } else if (key?.name === "right") {
          mov(1);
        } else if (key?.name === "up") {
          if (historyPos < history.length - 1) historyPos++;
          row = h(str()) - 1;
          col = str().length % w();
        } else if (key?.name === "down") {
          if (historyPos > -1) historyPos--;
          row = h(str()) - 1;
          col = str().length % w();
        } else {
          ins(chunk);
        }
        overwrite();
      };
      stdin.on("keypress", keypress);
    });
  while (true) {
    const line = await question();
    let txt = line;
    evaluate: try {
      const tks = lex(line);
      const f = tks.map((k) => k.image).join("");
      txt = f;
      erase(h(line));
      console.log(prompt + f);
      const t = tks.filter((t) => !"whitespace,comment".includes(t.kind));
      if (t.length === 0) break evaluate;
      const x = new Parser(t).program()[0];
      const r = await v.visit(x);
      if (x.kind === "binding")
        bdg[x.name] = r.kind === "function" ? r.arity : 0;
      erase(h(f));
      console.log(prompt + highlight(tks));
      if (x.kind !== "binding") {
        const out = await pretty(await execnilad(r));
        console.log(out.join("\n"));
      }
    } catch (e) {
      console.error(kleur.red(e instanceof Error ? e.message : e + ""));
    }
    history.unshift(txt);
  }
}
