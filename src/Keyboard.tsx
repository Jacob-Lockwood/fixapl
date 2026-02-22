import { glyphs } from "./glyphs";
const g = (s: keyof typeof glyphs) => glyphs[s].glyph;

function Key(props: { a?: string; A?: string; b?: string; B?: string }) {
  return (
    <table class="border-1 border-t-0 border-r-0 border-solid">
      <tbody>
        <tr>
          <td class="h-6 w-6 text-center align-middle">{props.A}</td>
          <td class="h-6 w-6 text-center align-middle">{props.B}</td>
        </tr>
        <tr>
          <td class="h-6 w-6 text-center align-middle">{props.a}</td>
          <td class="h-6 w-6 text-center align-middle">{props.b}</td>
        </tr>
      </tbody>
    </table>
  );
}
export function Keyboard() {
  return (
    <div class="flex flex-col items-center font-mono">
      <div class="flex border-t-1 border-r-1">
        <Key a="q" A="Q" b={g("rev")} B={g("rot")} />
        <Key a="w" A="W" b={g("w")} />
        <Key a="e" A="E" b={g("mem")} />
        <Key a="r" A="R" b={g("tak")} B={g("dro")} />
        <Key a="t" A="T" />
        <Key a="y" A="Y" />
        <Key a="u" A="U" />
        <Key a="i" A="I" b={g("iot")} B={g("whe")} />
        <Key a="o" A="O" />
        <Key a="p" A="P" b={g("pi")} B={g("tau")} />
      </div>
      <div class="flex border-r-1">
        <Key a="a" A="A" b={g("tra")} />
        <Key a="s" A="S" />
        <Key a="d" A="D" />
        <Key a="f" A="F" />
        <Key a="g" A="G" />
        <Key a="h" A="H" />
        <Key a="j" A="J" />
        <Key a="k" A="K" />
        <Key a="l" A="L" b={g("len")} B={g("sha")} />
      </div>
      <div class="flex border-r-1">
        <Key a="z" A="Z" />
        <Key a="x" A="X" b={g("enc")} B={g("par")} />
        <Key a="c" A="C" b={g("fix")} B={g("cou")} />
        <Key a="v" A="V" b={g("gru")} B={g("grd")} />
        <Key a="b" A="B" b={g("flo")} B={g("cei")} />
        <Key a="n" A="N" />
        <Key a="m" A="M" b={g("mat")} B={g("nmt")} />
      </div>
    </div>
  );
}
