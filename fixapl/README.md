# `fixapl` NPM package

This package contains both the FIXAPL CLI and the FIXAPL Node.js module.

Install the CLI with `npm install fixapl -g`. Run `fixapl help` to see the available commands.

The `fixapl` module has the following exports:

- `lex(source: string): Token[]`: given the source as a string, returns an array of tokens, or throws an error if there are unrecognized tokens.
- `Parser`: initialize the parser with `new Parser(tokens)` and use instance methods like `.program()` to parse that source to an AST.
- `Visitor`: initialize the visitor with a `Backend` and run `.visit(node: ASTNode)` to get the result of an expression, including running any side-effects. Use `.bindings` to get a map of identifier names to their associated bindings.
- `Backend`: Just an interface representing the backend functions of the runtime, accessed by quad functions. Not a class that can be initialized.

  ```typescript
  export type TextOptions = {
    text: string;
    fontSize: number;
    color?: number[];
    bg?: number[];
    fontFamily?: string;
  };
  export type Backend = {
    drawImage: (d: ImageData) => void;
    write: (s: string) => void;
    read: () => Promise<string | null>;
    drawText: (opts: TextOptions) => Promise<ImageData>;
  };
  ```

- `execnilad(v: Val): Promise<Val>`  
  If `v` is a zero-argument function, it is evaluated and its result is returned. This applies recursively so the result will never be a niladic function. Usually useful because `Visitor.visit` often returns niladic functions, and methods like `pretty` won't work how you expect when given them.
- `display(v: Val): Promise<string>`  
  Gives a string-representation of a value. This function attempts to give valid source code for that value.
- `pretty(v: Val): Promise<string[]>`  
  Gives a pretty-print representation of a value. The result is an array of lines; use `.join("\n")` as appropriate.
- `vToImg(v: Val): false | ImageData`  
  Convert a value representing an image to a DOM `ImageData` object. Returns `false` if `v` doesn't represent a valid image.
