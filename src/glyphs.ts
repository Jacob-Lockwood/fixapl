import * as p from "./primitives";
import { order, type Entry } from "./primitives";

export const prims = Object.fromEntries(
  Object.entries(p)
    .filter((g) => g[0] !== "display" && g[0] !== "order")
    .sort(
      (a, b) =>
        order.indexOf((a[1] as Entry).glyph) -
        order.indexOf((b[1] as Entry).glyph),
    ),
) as Omit<typeof p, "display" | "order">;

export type PrimitiveKind = `${"mon" | "dy"}adic ${"function" | "modifier"}`;

type GlyphKind = PrimitiveKind | "syntax" | "constant";
export const glyphs = {
  ...prims,
  "(": { name: "open parenthesis", glyph: "(", kind: "syntax" },
  ")": { name: "close parenthesis", glyph: ")", kind: "syntax" },
  "{": { name: "open dfn", glyph: "{", kind: "syntax" },
  "}": { name: "close dfn", glyph: "}", kind: "syntax" },
  "[": { name: "open array", glyph: "[", kind: "syntax" },
  "]": { name: "close array", glyph: "]", kind: "syntax" },
  "<<": { name: "open list", glyph: "⟨", kind: "syntax" },
  ">>": { name: "close list", glyph: "⟩", kind: "syntax" },
  ",": { name: "separator", glyph: ",", kind: "syntax" },
  _: { name: "ligature", glyph: "‿", kind: "syntax" },
  ":": { name: "binding", glyph: "←", kind: "syntax" },
  "#": { name: "comment", glyph: "⍝", kind: "syntax" },
} as const satisfies Record<
  string,
  { glyph: string; name: string; kind: GlyphKind }
>;

export const subscripts = "₀₁₂012";
