import { createEffect, createSignal, JSX } from "solid-js";
import { glyphs, ualpha, uomega } from "./glyphs";
const g = (s: keyof typeof glyphs) => glyphs[s].glyph;

export type KeyboardControls = {
  highlight(key: string | null): void;
  keyMap: Map<string, string>;
};
export function Keyboard(props: { ref?: (k: KeyboardControls) => void }) {
  const [highlight, setHighlight] = createSignal<string | null>(null);
  const keyMap = new Map<string, string>();
  keyMap.set(" ", g("_"));
  function Key(props: { a: string; A: string; b?: string; B?: string }) {
    // eslint-disable-next-line solid/reactivity
    if (props.b) keyMap.set(props.a, props.b);
    // eslint-disable-next-line solid/reactivity
    if (props.B) keyMap.set(props.A, props.B);
    // eslint-disable-next-line solid/reactivity
    const s = props.a + props.A + (props.b ?? "") + (props.B ?? "");
    return (
      <table
        class="h-12 w-12 border-1 border-t-0 border-r-0 border-solid"
        classList={{
          "outline-4 z-100 text-green-300": s.includes(highlight()!),
        }}
      >
        <tbody>
          <tr>
            <td class="h-1/2 w-1/2 text-center align-middle">{props.A}</td>
            <td class="h-1/2 w-1/2 text-center align-middle">{props.B}</td>
          </tr>
          <tr>
            <td class="h-1/2 w-1/2 text-center align-middle">{props.a}</td>
            <td class="h-1/2 w-1/2 text-center align-middle">{props.b}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  const PlaceholderKey = (props: { class: string }) => (
    <div class={`border-b-1 border-l-1 ${props.class}`} />
  );
  const KeyRow = (props: { top?: boolean; children?: JSX.Element }) => (
    <div
      class="bg-emerald-1000 flex min-h-12 border-r-1"
      classList={{ "border-t-1": props.top }}
    >
      {props.children}
    </div>
  );

  createEffect(() => props.ref?.({ keyMap, highlight: setHighlight }));
  return (
    <div
      class="flex flex-col items-center font-mono"
      classList={{ "text-gray-400": highlight() !== null }}
    >
      <KeyRow top>
        <Key a="`" A="~" B={g("emp")} />
        <Key a="1" A="!" b={g("mn")} B={g("unt")} />
        <Key a="2" A="@" b={g("dy")} B={g("rep")} />
        <Key a="3" A="#" b={g("eac")} B={g("#")} />
        <Key a="4" A="$" b={g("und")} B={g("ctc")} />
        <Key a="5" A="%" b={g("slf")} B={g("cho")} />
        <Key a="6" A="^" b={g("bac")} B={g("ari")} />
        <Key a="7" A="&" b={g("div")} B={g("%")} />
        <Key a="8" A="*" b={g("mul")} B={g("log")} />
        <Key a="9" A="(" b={g("inf")} B={g("<<")} />
        <Key a="0" A=")" b={g("sb")} B={g(">>")} />
        <Key a="-" A="_" b={g("ng")} B={g("not")} />
        <Key a="=" A="+" b={g("ne")} B={g("sig")} />
        <PlaceholderKey class="w-18" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-18" />
        <Key a="q" A="Q" b={g("rev")} B={g("rot")} />
        <Key a="w" A="W" b={g("w")} B={uomega} />
        <Key a="e" A="E" b={g("mem")} B={g("rou")} />
        <Key a="r" A="R" b={g("res")} B={g("sqr")} />
        <Key a="t" A="T" b={g("tra")} />
        <Key a="y" A="Y" b={g("tak")} B={g("max")} />
        <Key a="u" A="U" b={g("dro")} B={g("min")} />
        <Key a="i" A="I" b={g("iot")} B={g("whe")} />
        <Key a="o" A="O" b={g("ov")} />
        <Key a="p" A="P" b={g("pi")} B={g("tau")} />
        <Key a="[" A="{" b={g(":")} B={g("lft")} />
        <Key a="]" A="}" b={g("::")} B={g("rgt")} />
        <Key a="\" A="|" B={g("abs")} />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-21" />
        <Key a="a" A="A" b={g("a")} B={ualpha} />
        <Key a="s" A="S" b={g("sel")} B={g("pic")} />
        <Key a="d" A="D" b={g("len")} B={g("sha")} />
        <Key a="f" A="F" b={g("bef")} />
        <Key a="g" A="G" b={g("aft")} />
        <Key a="h" A="H" />
        <Key a="j" A="J" />
        <Key a="k" A="K" b={g("cel")} B={g("rnk")} />
        <Key a="l" A="L" b={g("&")} B={g("gro")} />
        <Key a=";" A=":" b={g("exc")} B={g("fmt")} />
        <Key a="'" A='"' b={g("fla")} B={g("con")} />
        <PlaceholderKey class="w-21" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-27" />
        <Key a="z" A="Z" b={g("tab")} B={g("win")} />
        <Key a="x" A="X" b={g("enc")} B={g("par")} />
        <Key a="c" A="C" b={g("fix")} B={g("cou")} />
        <Key a="v" A="V" b={g("gru")} B={g("grd")} />
        <Key a="b" A="B" b={g("flo")} B={g("cei")} />
        <Key a="n" A="N" b={g("mer")} B={g("fil")} />
        <Key a="m" A="M" b={g("mat")} B={g("nmt")} />
        <Key a="," A="<" b={g("cat")} B={g("lte")} />
        <Key a="." A=">" b={g("id")} B={g("gte")} />
        <Key a="/" A="?" b={g("fol")} B={g("rpl")} />
        <PlaceholderKey class="w-27" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-51" />
        <div
          class="flex w-60 items-end justify-center border-b-1 border-l-1 p-1"
          classList={{
            "outline-4 z-100 text-green-300": " ‿".includes(highlight()!),
          }}
        >
          <p>space</p>
          <p class="ml-10">{g("_")}</p>
        </div>
        <PlaceholderKey class="w-63" />
      </KeyRow>
    </div>
  );
}
