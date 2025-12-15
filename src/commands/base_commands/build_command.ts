import fs from "node:fs";
import path from "node:path";
import { flag } from "../../decorators/command/flag.js";
import { Command } from "../base_command.js";

export default class BuildCommand extends Command {
  static commandName = "build";
  static description = "Build the project for production, node.js only";
  static help = [
    "Build the project for production, node.js only",
    "It will create a production build of the project in the dist directory",
    "Must have a tsconfig.json file in the root of the project",
    "Must have esbuild installed as a dependency while running the command",
    "Must have esbuild-plugin-copy installed as a dependency while running the command if you want to copy assets to the output directory",
    "Example: npx balda build -t ./tsconfig.json -a ./assets",
  ];

  @flag({
    type: "boolean",
    aliases: ["c"],
    name: "clear-dist",
    required: false,
    defaultValue: false,
    description:
      "Whether to clear the dist directory before building the project",
  })
  static clearDist: boolean;

  @flag({
    type: "string",
    aliases: ["e"],
    name: "entry",
    required: false,
    defaultValue: "./src/index.ts",
    description: "The entry point of the project, default is ./src/index.ts",
  })
  static entry: string;

  @flag({
    type: "string",
    aliases: ["o"],
    name: "output",
    required: false,
    defaultValue: "./dist",
    description: "The path to the output directory, default is ./dist",
  })
  static output: string;

  @flag({
    type: "string",
    aliases: ["t"],
    name: "tsconfig",
    required: false,
    defaultValue: "./tsconfig.json",
    description:
      "The path to the tsconfig.json file, default is ./tsconfig.json",
  })
  static tsconfig: string;

  @flag({
    type: "string",
    aliases: ["a"],
    name: "assets",
    required: false,
    description:
      "The path to the assets directory that will be loaded in the production build",
  })
  static assets: string;

  @flag({
    type: "string",
    aliases: ["f"],
    name: "format",
    required: false,
    defaultValue: "esm",
    description:
      "The format to build the project, default is esm, can be 'esm' or 'cjs'",
  })
  static format: "esm" | "cjs";

  @flag({
    type: "string",
    aliases: ["p"],
    name: "packages",
    required: false,
    defaultValue: "external",
    description:
      "Weather to bundle node_modules or not, default is external, can be 'bundle' or 'external'",
  })
  static packages: "external" | "bundle";

  @flag({
    type: "boolean",
    aliases: ["s"],
    name: "sourcemap",
    required: false,
    defaultValue: true,
    description: "Whether to generate sourcemaps or not, default is true",
  })
  static sourcemap: boolean;

  static async handle(): Promise<void> {
    if (typeof process === undefined) {
      this.logger.error("Build command is only supported in node.js");
      process.exit(1);
    }

    if (!["esm", "cjs"].includes(this.format)) {
      this.logger.error("Invalid format, must be 'esm' or 'cjs'");
      process.exit(1);
    }

    if (!["bundle", "external"].includes(this.packages)) {
      this.logger.error("Invalid packages, must be 'bundle' or 'external'");
      process.exit(1);
    }

    const esbuild = await import("esbuild").catch((err) => {
      this.logger.error(
        "esbuild is not installed, please install it with `npm install -D esbuild` to use the build command",
      );
      throw new Error("esbuild is not installed");
    });

    const assetsDir = path.join(this.output, "assets");
    const plugins = [];
    if (this.assets) {
      const { copy } = await import("esbuild-plugin-copy").catch((err) => {
        this.logger.error(
          "esbuild-plugin-copy is not installed, please install it with `npm install -D esbuild-plugin-copy` to use the build command",
        );
        throw new Error("esbuild-plugin-copy is not installed");
      });

      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      plugins.push(
        copy({
          assets: {
            from: this.assets,
            to: assetsDir,
          },
        }),
      );
    }

    if (this.clearDist && fs.existsSync(this.output)) {
      this.logger.info(`Clearing dist directory...`);
      fs.rmSync(this.output, { recursive: true });
    }

    this.logger.info(`Building project...`);
    const outFile = path.join(this.output, "server.js");
    const result = await esbuild.build({
      tsconfig: this.tsconfig,
      entryPoints: [this.entry],
      bundle: true,
      platform: "node",
      outfile: outFile,
      minify: true,
      sourcemap: this.sourcemap,
      plugins,
      format: this.format,
      packages: this.packages,
    });

    if (result.errors.length) {
      this.logger.error(
        JSON.stringify(
          {
            message: "Failed to build the project",
            errors: result.errors,
          },
          null,
          2,
        ),
      );

      process.exit(1);
    }

    if (result.warnings.length) {
      this.logger.warn(
        JSON.stringify(
          {
            message: "Failed to build the project",
            warnings: result.warnings,
          },
          null,
          2,
        ),
      );
    }

    this.logger.info(
      JSON.stringify(
        {
          message: `Project built successfully in ${outFile}`,
          output: outFile,
          assets: this.assets ? true : false,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
}
