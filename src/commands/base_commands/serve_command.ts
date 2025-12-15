import { execSync } from "node:child_process";
import fs from "node:fs";
import { flag } from "../../decorators/command/flag.js";
import { getPackageManager, execWithPrompt } from "../../package.js";
import { nativeCwd } from "../../runtime/native_cwd.js";
import { runtime } from "../../runtime/runtime.js";
import { Command } from "../base_command.js";
import { CommandOptions } from "../command_types.js";
import { arg } from "../../decorators/command/arg.js";

export default class ServeCommand extends Command {
  static commandName = "serve";
  static description = "Run the server in dev mode with hot reload";
  static help = [
    "This command is intended to be run from the root of the project",
    "Bun and Deno have native dev hot reload",
    "Runtime is automatically inferred",
    "Node.js requires tsx to be installed for both typescript and javascript files",
    "Node.js dev dependencies (tsx) are installed automatically if not detected",
  ];

  static runtime = runtime.type;

  static options: CommandOptions = {
    keepAlive: true,
  };

  @arg({
    required: false,
    defaultValue: "src/index.ts",
    description: "The entry point of the project, default is src/index.ts",
  })
  static entry: string;

  @flag.string({
    aliases: ["d"],
    name: "deno-import-map",
    required: false,
    description: "Path to deno import map",
  })
  static denoImportMap?: string;

  static async handle(): Promise<void> {
    if (this.runtime === "bun") {
      execSync(`bun run --watch ${this.entry}`, {
        stdio: "inherit",
        cwd: nativeCwd.getCwd(),
      });
      return;
    }

    if (this.runtime === "deno") {
      let denoCommand = `deno run --watch --unstable-sloppy-imports --allow-all`;
      if (this.denoImportMap) {
        denoCommand = `${denoCommand} --import-map ${this.denoImportMap}`;
      }

      execSync(`${denoCommand} ${this.entry}`, {
        stdio: "inherit",
        cwd: nativeCwd.getCwd(),
      });
      return;
    }

    this.handleNodeHotReload();
  }

  private static async handleNodeHotReload() {
    const hasTsx = fs.existsSync("node_modules/.bin/tsx");
    if (!hasTsx) {
      const [packageManager, packageCommand, devFlag] =
        await getPackageManager();

      const installed = await execWithPrompt(
        `${packageManager} ${packageCommand} tsx ${devFlag}`,
        packageManager,
        ["tsx"],
        {
          stdio: "inherit",
        },
      );

      if (!installed) {
        this.logger.info(
          "Installation cancelled by user. Cannot start dev server without tsx.",
        );
        return;
      }
    }

    const initCommand = this.calledBy !== "node" ? this.calledBy : "npx";
    execSync(`${initCommand} tsx watch ${this.entry}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  }
}
