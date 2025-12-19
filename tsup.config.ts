import { defineConfig } from "tsup";

const external = [
  "glob",
  "pino",
  "ajv",
  "@aws-sdk/client-sqs",
  "sqs-consumer",
  "bullmq",
  "ioredis",
  "pg",
  "pg-boss",
  "ws",
  "node-cron",
  "mqtt",
];

export default defineConfig([
  {
    entry: ["src/index.ts"],
    outDir: "lib",
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external,
    splitting: false,
    treeshake: true,
    minify: true,
  },
  {
    entry: ["src/cli.ts"],
    outDir: "lib",
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: true,
    external,
    banner: {
      js: "#!/usr/bin/env node",
    },
    splitting: false,
    treeshake: true,
    minify: true,
  },
]);
