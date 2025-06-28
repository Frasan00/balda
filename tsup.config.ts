import { defineConfig } from "tsup";

const external = ["glob", "pino", "ajv", "ajv-formats"];

export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "lib",
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external,
  },
  {
    entry: ["src/cli.ts"],
    outDir: "lib",
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external,
  }
]);
