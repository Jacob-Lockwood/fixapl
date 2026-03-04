#!/usr/bin/env node
import { readFile } from "fs/promises";
import { argv } from "process";
import { version } from "../package.json";
import { lex, Parser, Visitor } from "./lang";
import { text } from "stream/consumers";
import { createInterface } from "readline/promises";
import { execnilad, Val } from "./util";
import pretty from "./pretty";
import { clearScreenDown, moveCursor } from "readline";
import { resolve } from "path";

const rl = createInterface({ input: process.stdin, output: process.stdout });

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
    write: (s) => process.stdout.write(s),
    // read:
  });
  async function run(s: string) {
    const p = new Parser(lex(s)).program();
    const o: Val[] = [];
    for (const x of p) o.push(await execnilad(await v.visit(x)));
    return o;
  }
  const fmt = (s: string) =>
    lex(s)
      .map((x) => x.image)
      .join("");
  if (argv[2]?.endsWith(".fxapl"))
    run(await readFile(resolve(process.cwd(), argv[2]), "utf8"));
  else if (argv[2] === "run") {
    if (!argv[3]) {
      const x = await text(process.stdin);
      console.log(x);
      await run(x.trim());
    } else run(await readFile(resolve(process.cwd(), argv[3]), "utf8"));
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
        moveCursor(process.stdout, 0, -1);
        clearScreenDown(process.stdout);
        console.log(prompt + f);
        for (const r of await run(line))
          console.log((await pretty(r)).join("\n"));
      } catch (e) {
        console.error(e);
      }
    }
  }
}
