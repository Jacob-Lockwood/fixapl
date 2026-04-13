import { createEffect, createSignal, JSX } from "solid-js";
import { Glyph, glyphs as g } from "#fixapl/glyphs";
import { Gly } from "./Highlight";
import keyboard from "#fixapl/keyboard.json";
export const keyMap = new Map(Object.entries(keyboard));

export type KeyboardControls = {
  highlight(key: string | null): void;
};

type GP = Glyph | string;
const sToGP = (s: string): GP =>
  Object.entries(g).find(([_, v]) => v.glyph === s)?.[1] ?? s;

export function Keyboard(props: { ref?: (k: KeyboardControls) => void }) {
  const [highlight, setHighlight] = createSignal<string | null>(null);
  function Key(props: { a: string; A: string }) {
    const b = keyMap.get(props.a);
    const B = keyMap.get(props.A);
    // eslint-disable-next-line solid/reactivity
    const s = props.a + props.A + b + B;
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
            <Td g={sToGP(props.A)} />
            <Td g={B && sToGP(B)} />
          </tr>
          <tr>
            <Td g={sToGP(props.a)} />
            <Td g={b && sToGP(b)} />
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

  createEffect(() => props.ref?.({ highlight: setHighlight }));
  return (
    <div
      class="flex flex-col items-center font-mono text-green-200/80"
      classList={{ "!text-gray-400": highlight() !== null }}
    >
      <KeyRow top>
        <Key a="`" A="~" />
        <Key a="1" A="!" />
        <Key a="2" A="@" />
        <Key a="3" A="#" />
        <Key a="4" A="$" />
        <Key a="5" A="%" />
        <Key a="6" A="^" />
        <Key a="7" A="&" />
        <Key a="8" A="*" />
        <Key a="9" A="(" />
        <Key a="0" A=")" />
        <Key a="-" A="_" />
        <Key a="=" A="+" />
        <PlaceholderKey class="w-18" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-18" />
        <Key a="q" A="Q" />
        <Key a="w" A="W" />
        <Key a="e" A="E" />
        <Key a="r" A="R" />
        <Key a="t" A="T" />
        <Key a="y" A="Y" />
        <Key a="u" A="U" />
        <Key a="i" A="I" />
        <Key a="o" A="O" />
        <Key a="p" A="P" />
        <Key a="[" A="{" />
        <Key a="]" A="}" />
        <Key a="\" A="|" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-21" />
        <Key a="a" A="A" />
        <Key a="s" A="S" />
        <Key a="d" A="D" />
        <Key a="f" A="F" />
        <Key a="g" A="G" />
        <Key a="h" A="H" />
        <Key a="j" A="J" />
        <Key a="k" A="K" />
        <Key a="l" A="L" />
        <Key a=";" A=":" />
        <Key a="'" A='"' />
        <PlaceholderKey class="w-21" />
      </KeyRow>
      <KeyRow>
        <PlaceholderKey class="w-27" />
        <Key a="z" A="Z" />
        <Key a="x" A="X" />
        <Key a="c" A="C" />
        <Key a="v" A="V" />
        <Key a="b" A="B" />
        <Key a="n" A="N" />
        <Key a="m" A="M" />
        <Key a="," A="<" />
        <Key a="." A=">" />
        <Key a="/" A="?" />
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
