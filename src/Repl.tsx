import {
  createSignal,
  createEffect,
  For,
  Show,
  Component,
  onMount,
} from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import ReplWorker from "./worker?worker";
import { MessageIn, MessageOut } from "./worker";
import { Token } from "./lang";
import { Glyph, glyphs, quad } from "./glyphs";
import { Highlight, glyphColors, special } from "./Highlight";
import { Keyboard, KeyboardControls } from "./Keyboard";

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

function setting(name: string, def: string) {
  const initial = localStorage.getItem(name);
  const [sig, setSig] = createSignal(initial ?? def);
  const setter = (val: string) => {
    setSig(val);
    localStorage.setItem(name, val);
  };
  return [sig, setter] as const;
}
function timeString(t: number) {
  if (t > 1000) return (t / 1000).toFixed(3) + "s";
  return t + "ms";
}

export type ReplRef = { process: (source: string) => void };
export const Repl: Component<{
  ref?: (r: ReplRef) => void;
  openDocs?: (glyph: Glyph) => void;
}> = (props) => {
  const [results, setResults] = createSignal<ReplEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [selectedGlyph, setSelectedGlyph] = createSignal(-1);
  const [unsubmitted, setUnsubmitted] = createSignal("");
  const [historyIdx, setHistoryIdx] = createSignal(-1);
  const [prefixHit, setPrefixHit] = createSignal(false);
  const [prefixKey, setPrefixKey] = setting("useKeyboard", "Tab");
  const [showKeyboard, setShowKeyboard] = setting("showKeyboard", "false");
  const [enterBehavior, setEnterBehavior] = setting("onEnter", "clear-prompt");
  const [displayTimes, setDisplayTimes] = setting("displayTimes", "false");
  const [autoImg, setAutoImg] = setting("autoImg", "false");
  const [pretty, setPretty] = setting("pretty", "true");
  const [defaultFont, setDefaultFont] = setting(
    "defaultFont",
    "TinyAPL386 Unicode",
  );
  const [bindings, setBindings] = createSignal(new Map<string, number>());
  const [disableEntry, setDisableEntry] = createSignal(false);
  let data: ReplEntry, setData: SetStoreFunction<ReplEntry>;

  const cToRgb = (c: number[]) =>
    `rgb(${c
      .slice(0, 3)
      .map((n) => n * 255)
      .join(" ")} / ${c[3] ?? 1})`;

  let worker = new ReplWorker();
  const msg = (s: MessageIn) => worker.postMessage(s);
  const onmessage = (worker.onmessage = (ev: MessageEvent<MessageOut>) => {
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
      setData("requestingInput", false);
      setDisableEntry(false);
    } else if (kind === "read") {
      setData("requestingInput", true);
      setTimeout(() => inp.focus(), 20);
    } else if (kind === "image") {
      setData("images", (i) => [...i, d]);
    } else if (kind === "write") {
      setData("output", (v) => v + d);
      if (d.includes("\b")) {
        const aud = new Audio("/minecraft_bell.wav");
        aud.volume = 0.5;
        aud.play();
      }
    } else if (kind === "text") {
      const cnv = (<canvas />) as HTMLCanvasElement;
      const ctx = cnv.getContext("2d")!;
      const font = `${d.fontSize}px ${d.fontFamily || `"${defaultFont()}"`}`;
      ctx.font = font;
      const { width, fontBoundingBoxDescent } = ctx.measureText(d.text);
      cnv.width = width;
      cnv.height = d.fontSize;
      if (d.bg) {
        ctx.fillStyle = cToRgb(d.bg);
        ctx.fillRect(0, 0, width, d.fontSize);
      }
      ctx.fillStyle = d.color ? cToRgb(d.color) : "white";
      ctx.font = font;
      ctx.fillText(d.text, 0, d.fontSize - fontBoundingBoxDescent);
      msg(["text", ctx.getImageData(0, 0, width, d.fontSize)]);
    }
  });
  const process = (source: string, tkns?: (t: Token[]) => void) => {
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
    msg([
      "eval",
      source,
      { autoImg: autoImg() === "true", pretty: pretty() === "true" },
    ]);
    if (tkns) createEffect(() => data.tokens && tkns(data.tokens));
  };
  let initial = `"Hello, world!"`;
  const runParam = new URLSearchParams(window.location.search).get("run");
  if (runParam) {
    const r = atob(runParam.replace(/-/g, "+").replace(/_/g, "/"));
    const u = Uint8Array.from(r, (m) => m.codePointAt(0)!);
    initial = new TextDecoder().decode(u);
  }
  process(initial);
  onMount(() => props.ref?.({ process }));
  let keyboard!: KeyboardControls;
  let textarea!: HTMLTextAreaElement;
  let inp!: HTMLTextAreaElement;
  return (
    <div class="sticky top-10 flex flex-col gap-2" id="repl">
      <div class="flex flex-col rounded-md bg-black/20 p-4 pt-1">
        <div class="flex items-center gap-4">
          <h2 class="mr-auto">REPL</h2>
          <button
            class="cursor-pointer text-2xl hover:text-red-500"
            title="Kill REPL"
            onClick={() => {
              const msg =
                "Are you sure you want to kill the REPL? Doing so will erase any bindings you have declared.";
              if (!confirm(msg)) return;
              worker.terminate();
              worker = new ReplWorker();
              worker.onmessage = onmessage;
              if (data.time) return;
              setDisableEntry(false);
              setData("error", "REPL terminated");
              setData("time", -1);
              setData("requestingInput", false);
            }}
          >
            <span class="material-symbols-outlined" title="kill repl">
              cancel
            </span>
          </button>
          <button
            class="cursor-pointer text-2xl"
            classList={{ "!cursor-not-allowed": disableEntry() }}
            title="Clear REPL"
            onClick={() => !disableEntry() && setResults([])}
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
            class="max-h-full w-full shrink-0 overflow-scroll border-b-2 border-emerald-600 p-4"
            classList={{ hidden: !settingsOpen() }}
          >
            <p class="mb-1 text-sm italic">Settings</p>
            <div class="grid grid-cols-2 place-items-start items-center gap-2">
              <label for="on-enter">On enter</label>
              <select
                id="on-enter"
                name="On enter"
                onInput={(e) => setEnterBehavior(e.target.value)}
              >
                <option
                  value="clear-prompt"
                  selected={enterBehavior() === "clear-prompt"}
                >
                  Clear prompt
                </option>
                <option
                  value="format-prompt"
                  selected={enterBehavior() === "format-prompt"}
                >
                  Format prompt
                </option>
              </select>
              <label for="displaytimes">Display times</label>
              <input
                type="checkbox"
                name="displaytimes"
                id="displaytimes"
                checked={displayTimes() === "true"}
                onInput={(e) => setDisplayTimes(e.target.checked + "")}
              />
              <label for="autoimg">Auto-show images</label>
              <input
                type="checkbox"
                name="autoimg"
                id="autoimg"
                checked={autoImg() === "true"}
                onInput={(e) => setAutoImg(e.target.checked + "")}
              />
              <label for="pretty">Pretty-print arrays</label>
              <input
                type="checkbox"
                name="pretty"
                id="pretty"
                checked={pretty() === "true"}
                onInput={(e) => setPretty(e.target.checked + "")}
              />
              <label for="keyboard">Show keyboard (WIP)</label>
              <input
                type="checkbox"
                name="keyboard"
                id="keyboard"
                checked={showKeyboard() === "true"}
                onInput={(e) => setShowKeyboard(e.target.checked + "")}
              />
              <label for="prefixkey">Keyboard prefix key</label>
              <input
                type="text"
                name="prefixkey"
                id="prefixkey"
                class="bg-green-300 px-1 text-green-800 focus:ring-4 focus:ring-green-800 focus:outline-0"
                value={prefixKey()}
                onInput={(e) => setPrefixKey(e.target.value)}
              />
              <label for="defaultfont">
                Default font for <code>{quad}Text</code>
              </label>
              <input
                type="text"
                name="defaultfont"
                id="defaultfont"
                list="font-families"
                class="bg-green-300 px-1 text-green-800 focus:ring-4 focus:ring-green-800 focus:outline-0"
                value={defaultFont()}
                onInput={(e) => setDefaultFont(e.target.value)}
              />
              <datalist id="font-families">
                <option value="TinyAPL386 Unicode" />
                <option value="APL333" />
                <option value="Uiua386" />
                <option value="Times New Roman" />
                <option value="Helvetica" />
                <option value="Wingdings" />
              </datalist>
            </div>
          </div>
          <ul class="flex h-full flex-col-reverse overflow-scroll pb-5 font-mono text-lg">
            <For each={results()}>
              {(result) => (
                <li>
                  <div
                    class="group flex min-w-max cursor-progress bg-teal-900/20 hover:bg-teal-900/50"
                    classList={{ "cursor-progress": result.time === null }}
                  >
                    <div class="w-[8ch] leading-0">
                      {result.time === null ? (
                        <span class="material-symbols-outlined scale-90 animate-spin">
                          progress_activity
                        </span>
                      ) : (
                        <button
                          class="cursor inline cursor-pointer group-hover:inline [@media(hover:hover)]:hidden"
                          title="copy link to this entry"
                          onClick={(ev) => {
                            const by = new TextEncoder().encode(result.source);
                            const b = btoa(String.fromCodePoint(...by));
                            const r = b.replace(/\+/g, "-").replace(/\//g, "_");
                            const url = `${window.location.origin}${window.location.pathname}?run=${r}`;
                            navigator.clipboard.writeText(url);
                            ev.target.textContent = "check";
                            setTimeout(
                              () => (ev.target.textContent = "link"),
                              1000,
                            );
                          }}
                        >
                          <span class="material-symbols-outlined scale-90">
                            link
                          </span>
                        </button>
                      )}
                    </div>
                    <pre
                      class="selection:!bg-white/50"
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
                          name="prompt"
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
                            <canvas width={dat.width} height={dat.height} />
                          ) as HTMLCanvasElement;
                          const ctx = canv.getContext("2d")!;
                          ctx.putImageData(dat, 0, 0);
                          const imgUrl = canv.toDataURL("image/png");
                          return (
                            <div class="group relative my-2 h-max">
                              {canv}
                              <a
                                class="absolute right-0 bottom-0 hidden cursor-pointer bg-green-950/80 p-1 leading-0 group-hover:block"
                                href={imgUrl}
                                download="fixapl_output.png"
                              >
                                <span class="material-symbols-outlined">
                                  arrow_circle_down
                                </span>
                              </a>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                    <pre class="leading-5 text-green-300">
                      {result.result.join("\n")}
                    </pre>
                    <pre class="text-red-300">{result.error}</pre>
                    <Show
                      when={displayTimes() === "true" && result.time !== null}
                    >
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
            // https://github.com/solidjs/vite-plugin-solid/issues/203
            spellcheck={"false" as unknown as boolean}
            onKeyDown={(ev) => {
              const charMods = ["Shift", "Alt", "Control"];
              const fnMods = [
                "Meta",
                "Enter",
                "Backspace",
                "Escape",
                "Tab",
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
              ];
              if (prefixHit() && !charMods.includes(ev.key)) {
                setPrefixHit(false);
                if (fnMods.includes(ev.key)) return;
                ev.preventDefault();
                const text = keyboard.keyMap.get(ev.key) ?? ev.key;
                textarea.setRangeText(text);
                textarea.selectionStart += text.length;
                return;
              }
              if (ev.key === prefixKey()) {
                ev.preventDefault();
                return setPrefixHit(true);
              }
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                if (!disableEntry()) {
                  if (enterBehavior() === "format-prompt") {
                    process(textarea.value, (t) => {
                      textarea.parentElement!.dataset.value = textarea.value =
                        t.map((z) => z.image).join("") ?? r.source;
                    });
                  } else {
                    process(textarea.value);
                    textarea.parentElement!.dataset.value = textarea.value = "";
                  }
                }
                return;
              }
              if (
                !(ev.altKey || ev.ctrlKey) ||
                !"ArrowUp,ArrowDown".includes(ev.key)
              ) {
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
            onInput={() => {
              textarea.parentElement!.dataset.value = textarea.value;
            }}
          />
        </div>
      </div>
      <div
        classList={{ hidden: showKeyboard() === "false" }}
        style={{ "--spacing": "0.18rem" }}
        class="text-xs"
      >
        <Keyboard ref={(k) => (keyboard = k)} />
      </div>
      <div class="flex flex-wrap text-3xl">
        <For each={Object.entries(glyphs)}>
          {([alias, data], i) => {
            const hover = () => {
              setSelectedGlyph(i());
              keyboard.highlight(data.glyph);
            };
            const exit = () => {
              setSelectedGlyph(-1);
              keyboard.highlight(null);
            };
            return (
              <button
                class="block cursor-pointer rounded-t-lg select-none focus:outline-0"
                classList={{ "bg-emerald-900": selectedGlyph() === i() }}
                onClick={(e) => {
                  if (e.shiftKey) return props.openDocs?.(data);
                  textarea.focus();
                  textarea.setRangeText(data.glyph);
                  textarea.selectionStart += data.glyph.length;
                }}
                onFocus={hover}
                onMouseEnter={hover}
                onBlur={exit}
                onMouseLeave={exit}
              >
                <span
                  class={"-z-10 p-2 font-mono " + glyphColors[data.kind]}
                  style={special.get(data.name)}
                >
                  {data.glyph}
                </span>
                <Show when={selectedGlyph() === i()}>
                  <p class="absolute z-10 w-max rounded-lg rounded-tl-none bg-emerald-900 px-2 py-1 text-base">
                    {data.name} <br /> alias:{" "}
                    <code class="bg-emerald-900 px-1">{alias}</code> <br />{" "}
                    {data.kind}
                  </p>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
      <p class="mx-auto my-4 max-w-80 text-center text-sm text-green-500 selection:!bg-black/30">
        Hover over a glyph to see its name and alias. <br /> Click on it to
        enter the glyph. <br /> Shift click to open its documentation.
      </p>
    </div>
  );
};
