import { ParentComponent } from "solid-js";
import { prims, glyphs, omega, alpha } from "./glyphs";
type PrimName = keyof typeof prims;

export default function Docs(p: { search: string }) {
  const Doc: ParentComponent<{
    prim?: PrimName; //| PrimName[];
    title?: string;
    keywords?: string;
    // eslint-disable-next-line solid/no-destructure
  }> = ({ title, prim, keywords, children }) => {
    let searchstr = title ?? "";
    if (prim) searchstr += prim + glyphs[prim].glyph + glyphs[prim].name;
    if (keywords) searchstr += keywords;
    const GlyphStr = (props: { n: PrimName }, g = glyphs[props.n]) => (
      <code>
        {g.glyph} {g.name}
      </code>
    );
    return (
      <li
        classList={{
          hidden: p.search !== "" && !searchstr.includes(p.search),
        }}
      >
        <h3>{title ?? <GlyphStr n={prim!} />}</h3>
        {children}
      </li>
    );
  };
  return (
    <ul>
      <Doc prim="fil">
        merge items {omega} filling with {alpha}
      </Doc>
      <Doc prim="fol">documentation for fold</Doc>
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
