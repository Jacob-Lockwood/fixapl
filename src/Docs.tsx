import { For, ParentComponent } from "solid-js";
import { prims, glyphs, omega, alpha, ualpha } from "./glyphs";
import { Code, CodeBlock, glyphColors, special } from "./Highlight";
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
        <details
          open={
            p.search !== "" &&
            searchstr.toLowerCase().includes(p.search.toLowerCase())
          }
          class="relative"
        >
          <summary class="bg-emerald-1000 sticky top-0">
            <h3 class="inline-block text-lg text-green-400">
              <For each={prims} fallback={title}>
                {(prim, idx) => (
                  <>
                    {idx() && <span> and </span>}
                    <GlyphStr n={prim} />
                  </>
                )}
              </For>
            </h3>
          </summary>
          {children}
        </details>
      </li>
    );
  };
  return (
    <ul class="flex flex-col gap-2">
      <Doc title="Trains">
        <p>
          in FIXAPL, you can write functions tacitly with a simple syntax called{" "}
          <i>trains</i>. if you've used other APL-family languages with trains,
          these'll feel familiar but a little different (and hopefully better).
        </p>
        <p class="mt-1">
          in general, expressions in FIXAPL are parsed from right to left, and
          are made up of many "tines," parts which are applied to the arguments
          of the overall train.
        </p>
        <p class="mt-1">
          a tine can be a value, a monadic function, or a dyadic function. if
          it's a value, it is used directly, if it's a monadic function, it is
          called with the right argument to the train, and if it's a dyadic
          function, it is called with both the left and right arguments.
        </p>
        <p class="mt-1">
          the rightmost part of any expression is either such a tine, or
          something of the form <Code>1+</Code> where a value is bound as the
          left argument to a dyadic function, resulting in a monadic tine.
        </p>
        <p class="mt-1">
          from that point, this base is built up on, moving to the left through
          the expression, from two patterns: <i>forks</i> and <i>atops</i>.
        </p>
        <p class="mt-1">
          the first pattern is atop. if there is a monadic function coming up
          left of the base, it is tacked on, being applied to the resulting
          value of everything to its right.
        </p>
        <p class="mt-1">
          for example, in <Code>(⍳⧻) 4‿3‿5</Code>, first the argument is passed
          to <Code>⧻</Code>, giving <Code>3</Code>, and then it is passed to{" "}
          <Code>⍳</Code>, giving <Code>0‿1‿2</Code>.
        </p>
        <p class="mt-1">
          the other pattern is fork. if there is a dyadic function coming up
          left of the base, it becomes a <i>forking function</i>, and it must
          have another tine to its left. when the expression is evaluated,
          everything to the right is called first; this overall result can be
          considered the right tine. next the left time is evaluated, and
          finally the forking function is called, passing the left tine on the
          left and the right tine on the right.
        </p>
        <p class="mt-1">
          this pattern is a bit more complicated, but it should make sense with
          some examples.
        </p>
        <p class="mt-1">
          a simple one is <Code>(±⊟⌵) ¯4</Code>. here, <Code>±</Code> and{" "}
          <Code>⌵</Code> are both applied to the argument, giving{" "}
          <Code>¯1</Code> and <Code>4</Code> respectively, and the results are
          passed to <Code>⊟</Code>, giving <Code>¯1‿4</Code>. the same principle
          applies for dyadic tines. <Code>1(=-≠)2</Code> is the same as{" "}
          <Code>(1=2)-(1≠2)</Code>. even <Code>2+2</Code> counts as a simple
          type of fork.
        </p>
        <p class="mt-1">
          these two patterns can be composed together in larger trains. the
          arity of the resulting expression is the greatest arity of any of its
          tines. consider a meaningless train with monadic{" "}
          <Code bindings={{ F: 1 }}>F</Code>, dyadic{" "}
          <Code bindings={{ G: 2 }}>G</Code>, and arbitrary arity{" "}
          <Code bindings={{ H: 0 }}>H</Code>:
        </p>
        <CodeBlock
          bindings={{ F: 1, G: 2, H: 0 }}
        >{`(F H G F H G F F H) ⍝ ← is equivalent to:
(F(H G(F(H G(F(F H))))))`}</CodeBlock>
        <p class="mt-1">
          if you enter a train into the REPL, its parenthesized form will be
          emitted.
        </p>
      </Doc>
      <Doc title="Array notation" keywords="[]⟨⟩‿">
        one way to make a list is to write its values separated by ligatures.
        this is called stranding:
        <CodeBlock>1‿2‿3</CodeBlock>
        another is by wrapping the values in <code>⟨⟩</code> and separating by
        commas:
        <CodeBlock>⟨1,2,3⟩</CodeBlock>
        to make a higher rank array, surround the cells you want to merge in{" "}
        <code>[]</code> and separate with commas:
        <CodeBlock>[⟨1,2⟩,⟨3,4⟩,⟨5,6⟩]</CodeBlock>
      </Doc>
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
      <Doc prim={["bef", "aft"]}>
        <div class="flex flex-col gap-2">
          <p>
            these two modifiers are used to express many cases of function
            composition. in both cases, the circle in the glyph points to the
            second function to be called. if that function is monadic, the
            resulting composition is equivalent to the 2-train with that
            function left of the other.
          </p>
          <table class="border-separate border-spacing-4">
            <thead>
              <tr>
                <th scope="col">
                  <CodeBlock>F⊸G</CodeBlock>
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
                  <CodeBlock bindings={{ F: 0, G: 1 }}>(G F)</CodeBlock>
                </td>
                <td>
                  <CodeBlock bindings={{ F: 0, G: 2 }}>{`{F G ⍵}`}</CodeBlock>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(1, "F₁")}</th>
                <td>
                  <CodeBlock bindings={{ F: 1, G: 1 }}>{`{G F ⍵}`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock
                    bindings={{ F: 1, G: 2 }}
                  >{`{(F ⍵) G ⍵}`}</CodeBlock>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(2, "F₂")}</th>
                <td>
                  <CodeBlock bindings={{ F: 2, G: 1 }}>{`{G ⍺ F ⍵}`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock
                    bindings={{ F: 2, G: 2 }}
                  >{`{(⍺ F ⍵) G ⍵}`}</CodeBlock>
                </td>
              </tr>
            </tbody>
          </table>
          <table class="border-separate border-spacing-4">
            <thead>
              <tr>
                <th scope="col">
                  <CodeBlock>F⟜G</CodeBlock>
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
                  <CodeBlock bindings={{ F: 1, G: 0 }}>{`(F G)`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock bindings={{ F: 1, G: 1 }}>{`{F G ⍵}`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock bindings={{ F: 1, G: 2 }}>{`{F ⍺ G ⍵}`}</CodeBlock>
                </td>
              </tr>
              <tr>
                <th scope="row">{ar(2, "F₂")}</th>
                <td>
                  <CodeBlock bindings={{ F: 2, G: 0 }}>{`{⍵ F G}`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock bindings={{ F: 2, G: 1 }}>{`{⍺ F G ⍵}`}</CodeBlock>
                </td>
                <td>
                  <CodeBlock
                    bindings={{ F: 2, G: 2 }}
                  >{`{⍺ F ⍺ G ⍵}`}</CodeBlock>
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
