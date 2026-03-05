#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { createInterface } from "readline/promises";
import { text } from "stream/consumers";
import { argv, cwd, stdin, stdout } from "process";
import { resolve } from "path";
import { version } from "../package.json";
import { lex, Parser, Visitor } from "./lang";
import { execnilad, Val } from "./util";
import pretty from "./pretty";

let rl = createInterface({ input: stdin, output: stdout }).pause();

const fmt = (s: string) =>
  lex(s)
    .map((x) => x.image)
    .join("");
const read = (p: string) => readFile(resolve(cwd(), p), "utf8");

if (["-v", "--version"].includes(argv[2])) console.log(version);
else if (["-h", "--help", "help"].includes(argv[2])) {
  console.log(`FIXAPL v${version}
    REPL:   fixapl
    run:    fixapl file.fxapl    or    fixapl run [file]   
    format: fixapl fmt [file]
    
    options: -h = --help, -v = --version
    `);
} else {
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
    for (const x of p) o.push(await execnilad(await v.visit(x)));
    return o;
  }
  if (argv[2]?.endsWith(".fxapl"))
    run(await readFile(resolve(cwd(), argv[2]), "utf8"));
  else if (argv[2] === "run") {
    await run(argv[3] ?? (await text(stdin)));
  } else if (argv[2] === "fmt") {
    if (!argv[3]) console.log(fmt(await text(stdin)));
    else await writeFile(argv[3], fmt(await read(argv[3])));
  } else if (!argv[2]) {
    console.log(`FIXAPL v${version} REPL`);
    console.log("type .exit to close");
    while (true) {
      const prompt = "        ";
      const line = await rl.question(prompt);
      if (line === ".exit") {
        rl.close();
        break;
      }
      try {
        const f = fmt(line);
        const h = Math.ceil(line.length / stdout.getWindowSize()[0]);
        stdout.moveCursor(0, -h);
        stdout.clearScreenDown();
        console.log(prompt + f);
        for (const r of await run(line))
          console.log((await pretty(r)).join("\n"));
      } catch (e) {
        console.error(e);
      }
    }
  }
}
