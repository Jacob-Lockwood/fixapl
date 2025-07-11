import { asyncMap, cells, display, isString, Val } from "./util";

type CharSet = Record<
  | `${"t" | "b"}${"l" | "r"}`
  | `h${"" | "u" | "d" | "v"}`
  | `v${"" | "l" | "r"}`,
  string
>;
const light: CharSet = {
  tl: "┌",
  tr: "┐",
  bl: "└",
  br: "┘",
  h: "─",
  hu: "┴",
  hv: "┼",
  hd: "┬",
  v: "│",
  vl: "┤",
  vr: "├",
};
const bold: CharSet = {
  tl: "┏",
  tr: "┓",
  bl: "┗",
  br: "┛",
  h: "━",
  hu: "┻",
  hv: "╋",
  hd: "┳",
  v: "┃",
  vl: "┫",
  vr: "┣",
};
const dbl = {
  tr: "╖",
  v: "║",
  vl: "╢",
  br: "╜",
  bld: "╘",
  brd: "╛",
  brb: "╝",
  h: "═",
  hu: "╧",
};

export default async function pretty(v: Val, c = light): Promise<string[]> {
  if (v.kind !== "array" || v.shape[0] === 0 || isString(v))
    return [await display(v)];
  if (v.shape.length === 0) {
    const s = await pretty(v.data[0]);
    const h = c.h.repeat(s[0].length);
    return [c.tl + h + c.tr, ...s.map((l) => c.v + l + c.v), c.bl + h + c.br];
  } else if (v.shape.length === 1) {
    if (v.data.every((x) => x.kind === "number")) {
      if (v.shape[0] === 1) return [`⟨${v.data[0].data}⟩`];
      return [v.data.map((v) => v.data).join("‿")];
    }
    const p = await asyncMap(v.data, (v) => pretty(v));
    const h = p.reduce((a, b) => Math.max(a, b.length), 1);
    const d = p.map((a) =>
      a.concat(Array(h - a.length).fill(" ".repeat(a[0].length))),
    );
    const hs = d.map((s) => c.h.repeat(s[0].length));
    const m = d.reduce((s1, s2) => s1.map((l, i) => l + c.v + s2[i]));
    const { tr, v: mr, br } = d.length === 1 ? dbl : c;
    return [
      c.tl + hs.join(c.hd) + tr,
      ...m.map((l) => c.v + l + mr),
      c.bl + hs.join(c.hu) + br,
    ];
  } else if (v.shape.length === 2) {
    if (v.data.every((v) => v.kind === "character")) {
      const h = bold.h.repeat(v.shape[1] + 2);
      const o = [bold.tl + h + bold.tr];
      for (let i = 0; i < v.shape[0]; i++) {
        const sec = v.data.slice(i * v.shape[1], (i + 1) * v.shape[1]);
        const s = String.fromCodePoint(...sec.map((c) => c.data));
        o.push(`${bold.v}"${s}"${bold.v}`);
      }
      o.push(bold.bl + h + bold.br);
      return o;
    }
    const p = await asyncMap(v.data, (v) => pretty(v));
    const rows: string[][][] = [];
    const cws: number[] = [];
    const rhs: number[] = [];
    for (let i = 0; i < v.shape[0]; i++) {
      rows[i] = [];
      for (let j = 0; j < v.shape[1]; j++) {
        const s = p[i * v.shape[1] + j];
        rows[i].push(s);
        if (s[0].length > (cws[j] ?? 0)) cws[j] = s[0].length;
        if (s.length > (rhs[i] ?? 0)) rhs[i] = s.length;
      }
    }
    const { tr, v: mr, vl: ir, br } = v.shape[1] === 1 ? dbl : c;
    const ar = v.shape[1] === 1 ? dbl.brb : dbl.brd;
    const hs = cws.map((l) => c.h.repeat(l));
    const top = c.tl + hs.join(c.hd) + tr;
    const inb = c.vr + hs.join(c.hv) + ir;
    const bot = c.bl + hs.join(c.hu) + br;
    const alt = dbl.bld + cws.map((l) => dbl.h.repeat(l)).join(dbl.hu) + ar;
    const b = v.shape[0] === 1 ? alt : bot;
    const m: string[] = [top];
    for (let i = 0; i < v.shape[0]; i++) {
      const lines: string[] = [];
      for (let j = 0; j < v.shape[1]; j++)
        for (let k = 0; k < rhs[i]; k++)
          lines[k] =
            (lines[k] ?? "") + c.v + (rows[i][j][k] ?? "").padStart(cws[j]);
      for (const l of lines) m.push(l + mr);
      m.push(i === v.shape[0] - 1 ? b : inb);
    }
    return m;
  } else return pretty(cells(v, v.shape.length % 2 === 0 ? -2 : -1), bold);
}
