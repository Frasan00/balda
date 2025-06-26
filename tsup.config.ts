import { defineConfig } from "tsup";

const external = ["glob", "pino", "ajv", "ajv-formats", "pino-pretty"];

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "lib",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external,
});
