import { For, ParentComponent } from "solid-js";
import { prims, glyphs, omega, alpha, ualpha } from "./glyphs";
import { Code, glyphColors, special } from "./Highlight";
type PrimName = keyof typeof prims;

const ar = (n: number, text: string) => (
  <code
    class={
      glyphColors[
        (
          [
            "syntax",
            "monadic function",
            "dyadic function",
            "monadic modifier",
            "dyadic modifier",
          ] as const
        )[n]
      ]
    }
  >
    {text}
  </code>
);

export default function Docs(p: { search: string }) {
  const GlyphStr = (props: { n: PrimName }, g = glyphs[props.n]) => (
    <code class={glyphColors[g.kind]} style={special.get(g.name)}>
      {g.glyph} {g.name}
    </code>
  );
  const Doc: ParentComponent<{
    prim?: PrimName | PrimName[];
    title?: string;
    keywords?: string;
    // eslint-disable-next-line solid/no-destructure
  }> = ({ title, prim, keywords, children }) => {
    const prims = prim ? [prim].flat() : [];
    let searchstr = title ?? "";
    for (const prim of prims)
      searchstr += prim + glyphs[prim].glyph + glyphs[prim].name;
    if (keywords) searchstr += keywords;

    return (
      <li
        classList={{
          hidden:
            p.search !== "" &&
            !searchstr.toLowerCase().includes(p.search.toLowerCase()),
        }}
      >
        <h3 class="text-lg text-green-400">
          <For each={prims} fallback={title}>
            {(prim, idx) => (
              <>
                {idx() && <span> and </span>}
                <GlyphStr n={prim} />
              </>
            )}
          </For>
        </h3>
        {children}
      </li>
    );
  };
  return (
    <ul class="flex flex-col gap-2">
      <Doc prim="fil">
        merge items of {omega}, filling with {alpha}
      </Doc>
      <Doc prim="fol">
        reduce with initial value: <br />
        call <code class={glyphColors["dyadic function"]}>
          {ualpha}
        </code> with {alpha} on the left and {omega}'s first cell on the right,
        then again with this result on the left and {omega}'s second cell on the
        right, and so on to the length of {omega}.
      </Doc>
      <Doc title="Array notation" keywords="[]⟨⟩‿">
        one way to make a list is to write its values separated by ligatures.
        this is called stranding:
        <Code>1‿2‿3</Code>
        another is by wrapping the values in <code>⟨⟩</code> and separating by
        commas:
        <Code>⟨1,2,3⟩</Code>
        to make a higher rank array, surround the cells you want to merge in{" "}
        <code>[]</code> and separate with commas:
        <Code>[⟨1,2⟩,⟨3,4⟩,⟨5,6⟩]</Code>
      </Doc>
      <Doc prim={["bef", "aft"]}>
        <div class="flex flex-col gap-2">
          <p>
            these two modifiers are used to express many cases of function
            composition. in both cases, the circle in the glyph points to the
            second function to be called.
          </p>
          <table class="border-separate border-spacing-4">
            <thead>
              <tr>
                <th scope="col">
                  <Code>F⊸G</Code>
                </th>
                <th scope="col" class="text-center">
                  {ar(1, "G₁")}
                </th>
                <th scope="col" class="text-center">
                  {ar(2, "G₂")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{ar(0, "F₀")}</th>
                <td>
                  <Code bindings={{ F: 0, G: 1 }}>(G F)</Code>
                </td>
                <td>
                  <Code bindings={{ F: 0, G: 2 }}>{`{F G ⍵}`}</Code>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(1, "F₁")}</th>
                <td>
                  <Code bindings={{ F: 1, G: 1 }}>{`{G F ⍵}`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 1, G: 2 }}>{`{(F ⍵) G ⍵}`}</Code>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(2, "F₂")}</th>
                <td>
                  <Code bindings={{ F: 2, G: 1 }}>{`{G ⍺ F ⍵}`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 2, G: 2 }}>{`{(⍺ F ⍵) G ⍵}`}</Code>
                </td>
              </tr>
            </tbody>
          </table>
          <table class="border-separate border-spacing-4">
            <thead>
              <tr>
                <th scope="col">
                  <Code>F⟜G</Code>
                </th>
                <th scope="col" class="text-center">
                  {ar(1, "G₀")}
                </th>
                <th scope="col" class="text-center">
                  {ar(1, "G₁")}
                </th>
                <th scope="col" class="text-center">
                  {ar(2, "G₂")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{ar(1, "F₁")}</th>
                <td>
                  <Code bindings={{ F: 1, G: 0 }}>{`(F G)`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 1, G: 1 }}>{`{F G ⍵}`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 1, G: 2 }}>{`{F ⍺ G ⍵}`}</Code>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(2, "F₂")}</th>
                <td>
                  <Code bindings={{ F: 2, G: 0 }}>{`{⍵ F G}`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 2, G: 1 }}>{`{⍺ F G ⍵}`}</Code>
                </td>
                <td>
                  <Code bindings={{ F: 2, G: 2 }}>{`{⍺ F ⍺ G ⍵}`}</Code>
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            there are a few cases which these don't cover directly but you can
            use <GlyphStr n="bac" /> and <GlyphStr n="slf" /> to reach those.
          </p>
        </div>
      </Doc>
    </ul>
  );
}
/*
<DocEntry
  keyword="= equal ≠ ne not equal "
  summary={<>pervasive comparison functions</>}
>
  <p>
    characters are compared by their codepoints. characters are
    always greater than numbers.
  </p>
</DocEntry>
<DocEntry
  keyword="+ add - subtract × multiply ÷ divide | modulo * power ⍟ logarithm"
  summary={<>arithmetic functions</>}
>
  <p>
    <code>| modulo</code> takes the divisor on the left rather
    than the right.
  </p>
</DocEntry>
<DocEntry
  keyword="⋈ reverse ⌽ rotate"
  summary={<>reverse & rotate</>}
>
  <p>
    <code>⋈ reverse</code> the cells of <code>⍵</code>
  </p>
  <p>
    <code>⌽ rotate</code> the cells of <code>⍵</code> to the left
    by <code>⍺</code> positions
  </p>
</DocEntry>
*/
