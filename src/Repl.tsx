import { createSignal, For, Show } from "solid-js";
import { Visitor, Token, lex, Parser } from "./lang";
import { display } from "./primitives";
import { Component } from "solid-js";
import { glyphs } from "./glyphs";

const glyphColors = {
  "monadic function": "text-lime-400",
  "dyadic function": "text-sky-400",
  "monadic modifier": "text-yellow-400",
  "dyadic modifier": "text-purple-300",
  syntax: "text-gray-300",
};

export const Highlight: Component<{
  tokens: readonly Token[];
  bindings?: Map<string, number>;
}> = (props) => {
  return props.tokens.map(({ kind, image }) => {
    switch (kind) {
      case "monadic function":
      case "dyadic function":
      case "monadic modifier":
      case "dyadic modifier":
        const color = glyphColors[kind];
        const { name } = Object.values(glyphs).find((d) => d.glyph === image)!;
        return (
          <span title={name} class={color}>
            {image}
          </span>
        );
      case "identifier":
        const arity = props.bindings?.get(image);
        const c = [
          "text-white",
          glyphColors["monadic function"],
          glyphColors["dyadic function"],
          "decoration-red-400 underline decoration-wavy decoration-1",
        ][arity ?? 3];
        return (
          <span class={`identifier ${c}`} data-name={image}>
            {image}
          </span>
        );
      case "string":
      case "character":
        return <span class="text-teal-300">{image}</span>;
      case "number":
        return <span class="text-orange-400">{image}</span>;
      default:
        return <span class={glyphColors.syntax}>{image}</span>;
    }
  });
};

type Result = {
  source: string;
  tokens: Token[] | null;
  output: string | null;
  error: string | null;
};

function setting(name: string, def: boolean) {
  const initial = localStorage.getItem(name);
  const [sig, setSig] = createSignal<boolean>(
    initial ? initial === "true" : def,
  );
  const toggle = (val: boolean) => {
    setSig(val);
    localStorage.setItem(name, "" + val);
  };
  return [sig, toggle] as const;
}

export function Repl() {
  const [results, setResults] = createSignal<Result[]>([]);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [selectedGlyph, setSelectedGlyph] = createSignal(-1);
  const [unsubmitted, setUnsubmitted] = createSignal("");
  const [historyIdx, setHistoryIdx] = createSignal(-1);
  const [clearPrompt, setClearPrompt] = setting("clearPrompt", true);

  const visitor = new Visitor();
  const process = (source: string) => {
    let tokens: Token[] | null = null;
    let output: string | null = null;
    let error: string | null = null;
    try {
      tokens = lex(source);
      const t = tokens.filter((x) => !"whitespace,comment".includes(x.kind));
      const p = new Parser(t).program();
      output = p.map((e) => display(visitor.visit(e))).join("\n");
    } catch (e) {
      error = e instanceof Error ? e.message : e + "";
      console.error(e);
    }
    setResults((results) => [{ source, tokens, output, error }, ...results]);
  };
  process(`"Hello, world!"`);
  let textarea!: HTMLTextAreaElement;
  return (
    <div class="sticky top-10 flex flex-col gap-2">
      <div class="flex flex-col rounded-md bg-black/20 p-4 pt-1 font-mono">
        <div class="flex items-center gap-4">
          <h2 class="mr-auto">REPL</h2>
          <button
            class="cursor-pointer text-2xl"
            title="Configuration options"
            onClick={() => setResults([])}
          >
            <span class="material-symbols-outlined" title="clear repl">
              backspace
            </span>
          </button>
          <button
            class="cursor-pointer text-2xl"
            title="Configuration options"
            onClick={() => setSettingsOpen((b) => !b)}
          >
            <span
              class="material-symbols-outlined"
              title="toggle settings menu"
            >
              settings
            </span>
          </button>
        </div>
        <div class="flex h-80 flex-col">
          <div
            class="w-full border-b-2 border-emerald-500 p-4"
            classList={{ hidden: !settingsOpen() }}
          >
            <p class="mb-1 text-sm italic">Settings</p>
            <div class="flex gap-4">
              <label for="clear">Clear prompt on enter</label>
              <input
                type="checkbox"
                name="clear"
                id="clear"
                checked={clearPrompt()}
                onInput={(e) => setClearPrompt(e.target.checked)}
              />
            </div>
          </div>
          <ul class="flex h-full flex-col-reverse overflow-scroll pb-5 text-lg">
            <For each={results()}>
              {(result) => (
                <li>
                  <pre
                    class="min-w-max bg-teal-900/20 pl-[8ch] hover:bg-teal-900/50"
                    onClick={(e) => {
                      textarea.parentElement!.dataset.value = textarea.value ||=
                        e.currentTarget.textContent ?? "";
                    }}
                  >
                    <code>
                      {result.tokens ? (
                        <Highlight
                          tokens={result.tokens}
                          bindings={
                            new Map(
                              [...visitor.bindings.entries()].map((z) => [
                                z[0],
                                z[1].kind === "function" ? z[1].arity : 0,
                              ]),
                            )
                          }
                        />
                      ) : (
                        result.source
                      )}
                    </code>
                  </pre>
                  {result.output ? (
                    <pre class="text-green-300">{result.output}</pre>
                  ) : (
                    <pre class="text-red-300">{result.error}</pre>
                  )}
                </li>
              )}
            </For>
          </ul>
        </div>
        <div
          class="-m-2 mt-auto grid overflow-x-scroll p-2 text-lg"
          id="wrapper"
        >
          <textarea
            id="code-input"
            ref={textarea}
            aria-label="REPL input line"
            class="resize-none overflow-hidden rounded-sm whitespace-pre ring-1 ring-green-500 focus:ring-2 focus:outline-0"
            rows="1"
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                process(textarea.value);
                if (clearPrompt()) {
                  textarea.parentElement!.dataset.value = textarea.value = "";
                }
                return;
              }
              if (!ev.altKey || !"ArrowUp,ArrowDown".includes(ev.key)) {
                setHistoryIdx(-1);
                setUnsubmitted(textarea.value);
                return;
              }
              ev.preventDefault();
              const up = ev.key === "ArrowUp";
              if (historyIdx() === -1) {
                setUnsubmitted(textarea.value);
                if (up) setHistoryIdx(0);
                else return;
              } else {
                if (up) setHistoryIdx((i) => Math.min(i + 1, results().length));
                else {
                  if (historyIdx() === 0) {
                    setHistoryIdx(-1);
                    textarea.parentElement!.dataset.value = textarea.value =
                      unsubmitted();
                    return;
                  }
                  setHistoryIdx((i) => i - 1);
                }
              }
              const r = results()[historyIdx()];
              const txt = r.tokens?.map((z) => z.image).join("") ?? r.source;
              textarea.parentElement!.dataset.value = textarea.value = txt;
            }}
            onInput={() =>
              (textarea.parentElement!.dataset.value = textarea.value)
            }
          ></textarea>
        </div>
      </div>
      <div class="flex flex-wrap text-3xl">
        {Object.entries(glyphs).map(([alias, data], i) => (
          <button
            class="block cursor-pointer rounded-t-sm select-none focus:outline-0"
            classList={{ "bg-emerald-800": selectedGlyph() === i }}
            onClick={() => {
              textarea.focus();
              textarea.setRangeText(data.glyph);
              textarea.selectionStart++;
            }}
            onFocus={() => setSelectedGlyph(i)}
            onMouseEnter={() => setSelectedGlyph(i)}
            onBlur={() => setSelectedGlyph(-1)}
            onMouseLeave={() => setSelectedGlyph(-1)}
          >
            <span class={"-z-10 p-2 " + glyphColors[data.kind]}>
              {data.glyph}
            </span>
            <Show when={selectedGlyph() === i}>
              <p class="absolute z-10 w-max rounded-sm rounded-tl-none bg-emerald-800 p-1 text-sm">
                {data.name} <br /> alias: {alias} <br /> {data.kind}
              </p>
            </Show>
          </button>
        ))}
      </div>
    </div>
  );
}
