#!/usr/bin/env node

import {
  lex,
  Parser,
  Visitor,
  pretty,
  Token,
  quadsList,
  execnilad,
  Val,
} from "./src/index";

import { createInterface } from "node:readline";
import * as colors from "colors/safe";
import { readFile, writeFile } from "node:fs/promises";
import { text } from "node:stream/consumers";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const helptext = `accepted usage:
  - fixapl run <filename>     run FIXAPL program at file
  - fixapl fmt <filename>     format FIXAPL file in-place
  - fixapl repl               start a REPL
  - fixapl help               display this help text
  - fixapl                    run FIXAPL program from STDIN`;

const visitor = new Visitor({
  drawImage: () => {
    throw new Error("cannot draw image in this context");
  },
  drawText: () => {
    throw new Error("cannot draw image in this context");
  },
  write: (s) => {
    process.stdout.write(s);
  },
  read: () => new Promise((resolve) => rl.once("line", resolve)),
});

const command = process.argv[2];
if (command === "run") {
  if (!process.argv[3]) {
    console.error("must provide file to run");
  } else
    readFile(process.cwd() + "/" + process.argv[3], "utf8").then(async (s) => {
      const t = lex(s);
      const p = new Parser(
        t.filter((tk) => tk.kind !== "comment" && tk.kind !== "space")
      ).program();
      for (const l of p) await execnilad(await visitor.visit(l));
    });
} else if (command === "fmt") {
  if (!process.argv[3]) {
    console.error("must provide file to run");
  } else {
    const path = process.cwd() + "/" + process.argv[3];
    readFile(path, "utf8").then((s) => {
      const t = lex(s).map((tk) => tk.image);
      writeFile(path, t.join("").trimEnd() + "\n");
    });
  }
} else if (command === "repl") {
  console.log(`FIXAPL REPL
^C to exit
`);
  const gc = {
    "monadic function": colors.green,
    "dyadic function": colors.blue,
    "monadic modifier": colors.yellow,
    "dyadic modifier": colors.magenta,
    constant: colors.red,
  };
  const highlight = (t: Token, b: Map<string, number>) => {
    if (t.kind in gc) return gc[t.kind as keyof typeof gc](t.image);
    if (t.kind === "identifier" || t.kind === "quad") {
      const arity =
        t.kind === "quad" ? quadsList.get(t.image.slice(1)) : b.get(t.image);
      const c =
        arity === 1
          ? gc["monadic function"]
          : arity === 2
          ? gc["dyadic function"]
          : colors.white;
      return c(t.image);
    } else if (t.kind === "character" || t.kind === "string")
      return colors.cyan(t.image);
    else if (t.kind === "number") return colors.red(t.image);
    else if (t.kind === "comment") return colors.gray(t.image);
    return colors.white(t.image);
  };
  const repl = () => {
    rl.question(">".padEnd(8), async (line) => {
      let t: Token[];
      try {
        t = lex(line);
      } catch {
        console.log("lexing error");
        return repl();
      }
      console.log(
        "".padEnd(8) + t.map((tk) => highlight(tk, new Map())).join("")
      );
      try {
        const p = new Parser(
          t.filter((tk) => tk.kind !== "comment" && tk.kind !== "space")
        );
        const s = p.program();
        const rs: Val[] = [];
        for (const l of s) rs.push(await execnilad(await visitor.visit(l)));
        for (const r of rs) console.log((await pretty(r)).join("\n"));
      } catch (e) {
        console.log(e);
      }
      repl();
    });
  };
  repl();
} else if (process.argv.length === 2) {
  text(process.stdin).then(async (s) => {
    const t = lex(s);
    const p = new Parser(
      t.filter((tk) => tk.kind !== "comment" && tk.kind !== "space")
    ).program();
    for (const l of p) await execnilad(await visitor.visit(l));
  });
} else if (process.argv[2] === "help") {
  console.log(helptext);
} else {
  console.error(`unrecognized command\n${helptext}`);
}
