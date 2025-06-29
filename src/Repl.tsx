import { createSignal, For, Show } from "solid-js";
import { Token } from "./lang";
import { Component } from "solid-js";
import { glyphs } from "./glyphs";
import { createStore, SetStoreFunction } from "solid-js/store";
import type { MessageIn, MessageOut } from "./worker";
import ReplWorker from "./worker?worker";
import { quadsList } from "./quads";

const glyphColors = {
  "monadic function": "text-lime-400",
  "dyadic function": "text-sky-400",
  "monadic modifier": "text-yellow-400",
  "dyadic modifier": "text-purple-300",
  syntax: "text-gray-300",
  constant: "text-orange-400",
};

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
              <span title={name} class={color}>
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
              "decoration-red-400 underline decoration-wavy decoration-1",
            ];
            return (
              <span class={`identifier ${cl[arity() ?? 3]}`} data-name={image}>
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

type ReplEntry = {
  source: string;
  tokens: Token[] | null;
  output: string;
  result: string[];
  error: string;
  images: ImageData[];
  time: number | null;
  requestingInput: boolean;
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
function timeString(t: number) {
  if (t > 1000) return (t / 1000).toFixed(3) + "s";
  return t + "ms";
}
export function Repl() {
  const [results, setResults] = createSignal<ReplEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [selectedGlyph, setSelectedGlyph] = createSignal(-1);
  const [unsubmitted, setUnsubmitted] = createSignal("");
  const [historyIdx, setHistoryIdx] = createSignal(-1);
  const [clearPrompt, setClearPrompt] = setting("clearPrompt", true);
  const [displayTimes, setDisplayTimes] = setting("displayTimes", false);
  const [bindings, setBindings] = createSignal(new Map<string, number>());
  const [disableEntry, setDisableEntry] = createSignal(false);

  let data: ReplEntry, setData: SetStoreFunction<ReplEntry>;
  // const worker = new Worker(new URL("./worker.ts", import.meta.url));
  const worker = new ReplWorker();
  const msg = (s: MessageIn) => worker.postMessage(s);
  worker.onmessage = (ev: MessageEvent<MessageOut>) => {
    const [kind, d] = ev.data;
    if (kind === "tokens") {
      setData("tokens", d);
    } else if (kind === "result") {
      setData("result", (v) => [...v, d]);
    } else if (kind === "bindings") {
      setBindings(d);
    } else if (kind === "error") {
      setData("error", d instanceof Error ? d.message : d + "");
      console.error(d);
    } else if (kind === "time") {
      setData("time", d);
      setDisableEntry(false);
    } else if (kind === "read") {
      setData("requestingInput", true);
      setTimeout(() => {
        inp.focus();
      }, 20);
    } else if (kind === "image") {
      setData("images", (i) => [...i, d]);
    } else if (kind === "write") {
      setData("output", (v) => v + d);
      if (d.includes("\b")) {
        const aud = new Audio("/minecraft_bell.wav");
        aud.volume = 0.5;
        aud.play();
      }
    }
  };
  const process = async (source: string) => {
    setDisableEntry(true);
    // data is re-assigned so each entry gets its own store
    // eslint-disable-next-line solid/reactivity
    [data, setData] = createStore<ReplEntry>({
      source,
      tokens: null,
      output: "",
      result: [],
      error: "",
      images: [],
      time: null,
      requestingInput: false,
    });
    setResults((res) => [data, ...res]);
    msg(["eval", source]);
  };
  process(`"Hello, world!"`);
  let textarea!: HTMLTextAreaElement;
  let inp!: HTMLTextAreaElement;
  return (
    <div class="sticky top-10 flex flex-col gap-2">
      <div class="flex flex-col rounded-md bg-black/20 p-4 pt-1">
        <div class="flex items-center gap-4">
          <h2 class="mr-auto" id="repl">
            REPL
          </h2>
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
        <div class="flex h-80 resize-y flex-col">
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
            <div class="flex gap-4">
              <label for="clear">Display times</label>
              <input
                type="checkbox"
                name="clear"
                id="clear"
                checked={displayTimes()}
                onInput={(e) => setDisplayTimes(e.target.checked)}
              />
            </div>
          </div>
          <ul class="flex h-full flex-col-reverse overflow-scroll pb-5 font-mono text-lg">
            <For each={results()}>
              {(result) => (
                <li>
                  <div
                    class="flex min-w-max cursor-progress bg-teal-900/20 hover:bg-teal-900/50"
                    classList={{ "cursor-progress": result.time === null }}
                  >
                    <div class="w-[8ch]">
                      <Show when={result.time === null}>
                        <span class="material-symbols-outlined scale-90 animate-spin">
                          progress_activity
                        </span>
                      </Show>
                    </div>
                    <pre
                      class="selection:!bg-black/50"
                      onClick={(e) => {
                        textarea.parentElement!.dataset.value =
                          textarea.value ||= e.currentTarget.textContent ?? "";
                      }}
                    >
                      <code>
                        {result.tokens ? (
                          <Highlight
                            tokens={result.tokens!}
                            bindings={bindings()}
                          />
                        ) : (
                          result.source
                        )}
                      </code>
                    </pre>
                  </div>
                  <div class="min-h-7">
                    <pre class="text-emerald-500">
                      {result.output}
                      <Show when={result.requestingInput}>
                        <textarea
                          name="prmt"
                          id="prmt"
                          ref={inp}
                          placeholder="input"
                          rows={1}
                          class="mx-0.5 inline-block min-w-2 rounded-xs bg-green-300 px-1 align-top text-green-900 outline-2 outline-green-500"
                          onKeyDown={(ev) => {
                            if (ev.key !== "Enter") return;
                            ev.preventDefault();
                            setData("requestingInput", false);
                            msg(["input", ev.currentTarget.value]);
                          }}
                        />
                      </Show>
                    </pre>
                    <div class="flex flex-wrap gap-x-2">
                      <For each={result.images}>
                        {(dat) => {
                          const canv = (
                            <canvas
                              width={dat.width}
                              height={dat.height}
                              class="my-2 object-contain"
                            />
                          ) as HTMLCanvasElement;
                          const ctx = canv.getContext("2d")!;
                          ctx.putImageData(dat, 0, 0);
                          return canv;
                        }}
                      </For>
                    </div>
                    <pre class="text-green-300">{result.result.join("\n")}</pre>
                    <pre class="text-red-300">{result.error}</pre>
                    <Show when={displayTimes() && result.time !== null}>
                      <pre class="text-emerald-600">
                        Finished in {timeString(result.time!)}
                      </pre>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </div>
        <div
          class="-m-2 mt-auto grid overflow-x-scroll p-2 font-mono text-lg"
          id="wrapper"
        >
          <textarea
            id="code-input"
            ref={textarea}
            aria-labelledby="repl"
            class="resize-none overflow-hidden rounded-sm whitespace-pre ring-1 ring-green-500 focus:ring-2 focus:outline-0"
            rows="1"
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                if (!disableEntry()) {
                  process(textarea.value);
                  if (clearPrompt()) {
                    textarea.parentElement!.dataset.value = textarea.value = "";
                  }
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
          />
        </div>
      </div>
      <div class="flex flex-wrap text-3xl">
        <For each={Object.entries(glyphs)}>
          {([alias, data], i) => (
            <button
              class="block cursor-pointer rounded-t-sm select-none focus:outline-0"
              classList={{ "bg-emerald-800": selectedGlyph() === i() }}
              onClick={() => {
                textarea.focus();
                textarea.setRangeText(data.glyph);
                textarea.selectionStart++;
              }}
              onFocus={() => setSelectedGlyph(i())}
              onMouseEnter={() => setSelectedGlyph(i())}
              onBlur={() => setSelectedGlyph(-1)}
              onMouseLeave={() => setSelectedGlyph(-1)}
            >
              <span class={"-z-10 p-2 font-mono " + glyphColors[data.kind]}>
                {data.glyph}
              </span>
              <Show when={selectedGlyph() === i()}>
                <p class="absolute z-10 w-max rounded-sm rounded-tl-none bg-emerald-800 px-2 py-1 text-base">
                  {data.name} <br /> alias:{" "}
                  <code class="bg-emerald-900 px-1">{alias}</code> <br />{" "}
                  {data.kind}
                </p>
              </Show>
            </button>
          )}
        </For>
      </div>
      <p class="mx-auto my-4 max-w-80 text-center text-sm text-green-500 selection:!bg-black/30">
        Hover over a glyph to see its name and alias. Click on it to enter the
        glyph.
      </p>
    </div>
  );
}
