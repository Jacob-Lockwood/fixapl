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
          <img class="mx-auto h-30 w-30" src="/FIXAPL.svg" alt="FIXAPL logo." />
          <h1 class="mt-2 text-center text-3xl tracking-wider text-emerald-200">
            FIXAPL
          </h1>
          <p class="mb-10 text-center text-lg italic">
            A simple APL derivative, built on fixed-arity functions
          </p>
          <details class="mb-10 text-amber-200">
            <summary class="text-orange-400 italic">
              <strong>Note:</strong>{" "}
              <span class="text-amber-400">
                This language and website are in beta. Lots of things are
                unfinished.
              </span>
            </summary>
            <p class="mt-1">
              Several planned primitives have not been implemented yet. There is
              currently zero documentation for the language. The existing help
              text on the site is either outdated or speculative. Expect
              everything to change.
            </p>
            <p class="mt-2">
              If you do find bugs with the existing primitives, please report
              them to me, either via GitHub issues or on Discord (DM @jacob.abc
              or ping me in the #general-programming channel of the Uiua
              discord.)
            </p>
          </details>

          <details>
            <summary class="text-emerald-500 underline underline-offset-2">
              Why fixed arity
            </summary>
            <p class="mt-1">
              Arity, also known as{" "}
              <a
                class="text-green-500 underline"
                target="_blank"
                href="https://aplwiki.com/wiki/Function#Function_valence"
              >
                valence
              </a>
              , is the number of arguments that a function takes. In APL syntax,
              all functions can be called with either one argument or two
              arguments (known as monadic and dyadic calls), though some
              functions are only defined to have meaning for one or the other.
            </p>
            <p class="mt-2">
              In FIXAPL, this is not the case; every function has only a single
              way to be called, and this is ingrained into the syntax. This is
              referred to as <i>fixed-arity</i>.
            </p>
            <p class="mt-2">
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
            <ol class="flex list-decimal flex-col gap-2 pt-2 pl-8">
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
                  compact trains is largely inspired by the language{" "}
                  <a
                    href="https://github.com/DennisMitchell/jellylanguage"
                    class="text-green-500 underline"
                    target="_blank"
                  >
                    Jelly
                  </a>
                  , which implements a variation of the same idea.
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
      <footer class="mx-auto mt-60 flex max-w-prose flex-col gap-2 text-center text-sm text-emerald-500">
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
          Contribute to or view this page's source on{" "}
          <a
            href="https://github.com/Jacob-Lockwood/fixapl"
            class="underline"
            target="_blank"
          >
            GitHub
          </a>
          .
        </p>
        <p>
          This page uses the fonts{" "}
          <a
            href="https://apl385.com/fonts/index.htm"
            class="underline"
            target="_blank"
          >
            APL333
          </a>
          ,{" "}
          <a
            href="https://github.com/RubenVerg/tinyapl386/blob/97fb8c10bbb5ac9d34555812cfed0070c545fa4c/TinyAPL386.ttf"
            class="underline"
            target="_blank"
          >
            TinyAPL386
          </a>
          , and{" "}
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
          The FIXAPL logo was modified from the official{" "}
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
