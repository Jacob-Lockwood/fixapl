import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/*.ts"],
  copy: ["./src/keyboard.json"],
  dts: { build: true },
});
