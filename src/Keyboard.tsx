import { createEffect, createSignal, JSX } from "solid-js";
import { Glyph, glyphs as g } from "./glyphs";
import { Gly } from "./Highlight";

export type KeyboardControls = {
  highlight(key: string | null): void;
  keyMap: Map<string, string>;
};
export function Keyboard(props: { ref?: (k: KeyboardControls) => void }) {
  const [highlight, setHighlight] = createSignal<string | null>(null);
  const keyMap = new Map<string, string>();
  keyMap.set(" ", g._.glyph);
  type GP = Glyph | string;
  function Key(props: { a: GP; A: GP; b?: GP; B?: GP }) {
    const toS = (a: GP) => (typeof a === "string" ? a : a.glyph);
    // eslint-disable-next-line solid/reactivity
    if (props.b) keyMap.set(toS(props.a), toS(props.b));
    // eslint-disable-next-line solid/reactivity
    if (props.B) keyMap.set(toS(props.A), toS(props.B));
    const s = // eslint-disable-next-line solid/reactivity
      toS(props.a) + toS(props.A) + toS(props.b ?? "") + toS(props.B ?? "");
    const Td = (props: { g: GP | undefined }) => (
      <td class="h-1/2 w-1/2 text-center align-middle">
        {typeof props.g === "string" ? props.g : props.g && <Gly g={props.g} />}
      </td>
    );
    return (
      <table
        class="h-12 w-12 border-1 border-t-0 border-r-0 border-solid"
        classList={{
          "outline-4 z-100 text-green-300": s.includes(highlight()!),
        }}
      >
        <tbody>
          <tr>
            <Td g={props.A} />
            <Td g={props.B} />
          </tr>
          <tr>
            <Td g={props.a} />
            <Td g={props.b} />
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
      class="flex flex-col items-center font-mono text-green-200/80"
      classList={{ "!text-gray-400": highlight() !== null }}
    >
      <KeyRow top>
        <Key a="`" A="~" B={g.emp} />
        <Key a="1" A="!" b={g.mn} B={g.unt} />
        <Key a="2" A="@" b={g.dy} B={g.rep} />
        <Key a="3" A="#" b={g.eac} B={g["#"]} />
        <Key a="4" A="$" b={g.und} B={g.ctc} />
        <Key a="5" A="%" b={g.slf} B={g.cho} />
        <Key a="6" A="^" b={g.bac} B={g.ari} />
        <Key a="7" A="&" b={g.div} B={g["%"]} />
        <Key a="8" A={g.pow} b={g.mul} B={g.log} />
        <Key a="9" A={g["("]} b={g.inf} B={g["<<"]} />
        <Key a="0" A={g[")"]} b={g.sb} B={g[">>"]} />
        <Key a={g.sub} A="_" b={g.ng} B={g.not} />
        <Key a={g.eq} A={g.add} b={g.ne} B={g.sig} />
        <PlaceholderKey class="w-18" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-18" />
        <Key a="q" A="Q" b={g.rev} B={g.rot} />
        <Key a="w" A="W" b={g.w} B={g.ww} />
        <Key a="e" A="E" b={g.mem} B={g.rou} />
        <Key a="r" A="R" b={g.res} B={g.sqr} />
        <Key a="t" A="T" b={g.tra} />
        <Key a="y" A="Y" b={g.tak} B={g.max} />
        <Key a="u" A="U" b={g.dro} B={g.min} />
        <Key a="i" A="I" b={g.iot} B={g.whe} />
        <Key a="o" A="O" b={g.ov} />
        <Key a="p" A="P" b={g.pi} B={g.tau} />
        <Key a={g["["]} A={g["{"]} b={g[":"]} B={g.lft} />
        <Key a={g["]"]} A={g["}"]} b={g["::"]} B={g.rgt} />
        <Key a={g.sca} A={g.mod} B={g.abs} />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-21" />
        <Key a="a" A="A" b={g.a} B={g.aa} />
        <Key a="s" A="S" b={g.sel} B={g.pic} />
        <Key a="d" A="D" b={g.len} B={g.sha} />
        <Key a="f" A="F" b={g.bef} />
        <Key a="g" A="G" b={g.aft} />
        <Key a="h" A="H" />
        <Key a="j" A="J" />
        <Key a="k" A="K" b={g.cel} B={g.rnk} />
        <Key a="l" A="L" b={g["&"]} B={g.gro} />
        <Key a=";" A=":" b={g.exc} B={g.fmt} />
        <Key a="'" A='"' b={g.fla} B={g.con} />
        <PlaceholderKey class="w-21" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-27" />
        <Key a="z" A="Z" b={g.tab} B={g.win} />
        <Key a="x" A="X" b={g.enc} B={g.par} />
        <Key a="c" A="C" b={g.fix} B={g.cou} />
        <Key a="v" A="V" b={g.gru} B={g.grd} />
        <Key a="b" A="B" b={g.flo} B={g.cei} />
        <Key a="n" A="N" b={g.mer} B={g.fil} />
        <Key a="m" A="M" b={g.mat} B={g.nmt} />
        <Key a="," A={g.gt} b={g.cat} B={g.ge} />
        <Key a="." A={g.lt} b={g.id} B={g.le} />
        <Key a={g.red} A={g.rol} b={g.fol} B={g.rpl} />
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
          <p class="ml-10">
            <Gly g={g._} />
          </p>
        </div>
        <PlaceholderKey class="w-63" />
      </KeyRow>
    </div>
  );
}
