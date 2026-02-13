import { Component, For } from "solid-js";
import { Token } from "./lang";
import { glyphs } from "./glyphs";
import { quadsList } from "./quads";
export const glyphColors = {
  "monadic function": "text-lime-400",
  "dyadic function": "text-sky-400",
  "monadic modifier": "text-yellow-400",
  "dyadic modifier": "text-purple-300",
  syntax: "text-gray-300",
  constant: "text-orange-400",
};
export const special = new Map([
  [
    "transpose",
    "background-clip: text; color: transparent; background-image: linear-gradient(180deg, #5BCEFA 34%, #F5A9B8 34%, #F5A9B8 45%, #FFFFFF 45%, #FFFFFF 56%, #F5A9B8 56%, #F5A9B8 67%, #5BCEFA 67%)",
  ],
  ["left dfn argument", "color: var(--color-red-400)"],
  ["right dfn argument", "color: var(--color-red-400)"],
]);
export const Highlight: Component<{
  tokens: readonly Token[];
  bindings: Map<string, number>;
}> = (props) => {
  return (
    <For each={props.tokens}>
      {({ kind, image }) => {
        switch (kind) {
          case "monadic function":
          case "dyadic function":
          case "monadic modifier":
          case "dyadic modifier":
          case "constant":
            const color = glyphColors[kind];
            const { name } = Object.values(glyphs).find(
              (d) => d.glyph === image,
            )!;
            return (
              <span title={name} class={color} style={special.get(name)}>
                {image}
              </span>
            );
          case "quad":
          case "identifier":
            const arity = () =>
              kind === "quad"
                ? quadsList.get(image.slice(1))!
                : props.bindings?.get(image);
            const cl = [
              "text-white",
              glyphColors["monadic function"],
              glyphColors["dyadic function"],
            ];
            return (
              <span class={`identifier ${cl[arity() ?? 0]}`} data-name={image}>
                {image}
              </span>
            );
          case "string":
          case "character":
            return <span class="text-teal-300">{image}</span>;
          case "number":
            return <span class="text-orange-400">{image}</span>;
          case "comment":
            return <span class="text-stone-400 italic">{image}</span>;
          case "left dfn argument":
          case "right dfn argument":
            return <span class="text-red-400">{image}</span>;
          default:
            return <span class={glyphColors.syntax}>{image}</span>;
        }
      }}
    </For>
  );
};
