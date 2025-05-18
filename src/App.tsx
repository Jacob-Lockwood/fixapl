import { ParentComponent } from "solid-js";
import { Repl } from "./Repl";

const Kbd: ParentComponent = (props) => (
  <kbd class="rounded-sm border-b-4 border-green-700 bg-green-900 px-1">
    {props.children}
  </kbd>
);

export default function App() {
  return (
    <div class="mx-auto flex min-h-screen flex-col bg-emerald-950/70 p-5 text-emerald-300 selection:bg-green-800 sm:p-10 md:w-3/4 lg:py-20">
      <div class="lg:flex">
        <div class="mx-auto mb-10 max-w-prose lg:w-2/5">
          <img
            class="mx-auto h-30 w-30"
            src="/APL_FIX.svg"
            alt="FIX APL logo."
          />
          <h1 class="text-center text-2xl text-emerald-200">Fixed-arity APL</h1>
          <p class="mb-10 text-center italic">
            A simple APL derivative, built on fixed-arity functions
          </p>
          <details>
            <summary class="text-emerald-500 underline underline-offset-2">
              Why fixed arity
            </summary>
            <p class="mt-1">
              I've written about the motivations for fixed-arity to a greater
              extent{" "}
              <a
                href="https://example.com"
                class="text-green-500 underline"
                target="_blank"
              >
                here
              </a>
              , but to summarize the main points:
            </p>
            <ol class="flex list-decimal flex-col gap-2 pl-8">
              <li>
                <p>
                  The overloading of glyphs to have different meanings when
                  called monadically versus dyadically can be confusing. This is
                  not universally true, and many glyph-pairings just feel
                  natural, but others don't. Marshall Lochbaum has written about
                  this{" "}
                  <a
                    href="https://mlochbaum.github.io/BQN/commentary/overload.html"
                    class="text-green-500 underline"
                    target="_blank"
                  >
                    here
                  </a>{" "}
                  in the context of BQN.
                </p>
              </li>
              <li>
                <p>
                  In Uiua, functions having fixed arity lets modifiers have
                  different behavior depending on the arities of their operands,
                  which is very useful in many situations. In APL and the like,
                  this is just impossible, and the best they can do is
                  overloading the resulting function to have different meaning
                  if it is called monadically or dyadically, which is far more
                  limited.
                </p>
              </li>
              <li>
                <p>
                  Traditionally, trains are composed of many sequential fork
                  operations; <code class="bg-black/30 px-1">F G H</code>{" "}
                  represents G called with the results of F and H applied to the
                  function's arguments. But what if you want to include monadic
                  function applications within a train? This is a very common
                  want, but the fork-based train construction provides no clear
                  solution. Language designers have noticed this and attempted
                  to remedy it: J's cap <code class="bg-black/30 px-1">[:</code>{" "}
                  and BQN's Nothing <code class="bg-black/30 px-1">·</code>{" "}
                  offer a concise way to insert an atop into a train, while Kap
                  chooses to replace fork-trains with trains made solely of
                  atops and have a special syntax for forks.
                </p>
                <p class="mt-2">
                  Making functions have fixed arity actually provides a very
                  elegant solution to this problem, without needing any extra
                  syntax. Instead of breaking expressions into only forks, the
                  expression can be broken into forks, atops, even hooks, based
                  entirely on the arity of the tines. Examples of this can be
                  found in the language reference on this page. Another nice
                  consequence of this is that a train may have a value as its
                  rightmost tine and still resolve to a function rather than a
                  value.
                </p>
                <p class="mt-2">
                  This element of using fixed-arity functions to write more
                  compact trains is largely inspired by the language Jelly,
                  which implements a variation of the same idea.
                </p>
              </li>
            </ol>
          </details>
          <details class="mt-5">
            <summary class="text-emerald-500 underline underline-offset-2">
              How to use this page
            </summary>
            <p class="mt-1 text-emerald-300">
              Click in the REPL textarea to write statements, and press{" "}
              <Kbd>Enter</Kbd> to process them. Glyphs can be entered by typing
              in the appropriate alias given in the documentation. Use{" "}
              <Kbd>Shift+Enter</Kbd> to enter a newline instead of entering the
              code. Click on a previously inputted segment to paste it into the
              textbox.
            </p>
          </details>
        </div>
        <main class="mx-auto max-w-[80ch] lg:w-3/5 lg:pl-10">
          <Repl />
        </main>
      </div>
      <footer class="mx-auto mt-60 flex max-w-prose flex-col gap-2 text-center text-emerald-600">
        <p>
          Contribute to or view this page's source on{" "}
          <a
            href="https://github.com/Jacob-Lockwood/fixed-arity-apl"
            class="underline"
            target="_blank"
          >
            GitHub
          </a>
          .
        </p>
        <p>
          Created by{" "}
          <a
            href="https://github.com/Jacob-Lockwood"
            class="underline"
            target="_blank"
          >
            Jacob Lockwood
          </a>
          .
        </p>
        <p>
          The monospaced font used on this page is{" "}
          <a
            href="https://github.com/uiua-lang/uiua/blob/main/src/algorithm/Uiua386.ttf"
            class="underline"
            target="_blank"
          >
            Uiua386
          </a>
          .
        </p>
        <p>
          The FIX APL logo was modified from the official{" "}
          <a
            href="https://aplwiki.com/wiki/File:APL_logo.png"
            class="underline"
            target="_blank"
          >
            APL logo
          </a>
          . The font used is{" "}
          <a
            href="https://indestructibletype.com/Besley.html"
            class="underline"
            target="_blank"
          >
            Besley.
          </a>
        </p>
      </footer>
    </div>
  );
}
