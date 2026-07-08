import { execSync } from "node:child_process";
import fs from "node:fs";
import { flag } from "../../decorators/command/flag.js";
import { getPackageManager, execWithPrompt } from "../../package.js";
import { nativeCwd } from "../../runtime/native_cwd.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { runtime, type RunTimeType } from "../../runtime/runtime.js";
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

  /**
   * Detects the effective runtime the user intends to use for the dev server.
   *
   * The compiled CLI ships with a `#!/usr/bin/env node` shebang, so when a
   * user runs `bun run balda serve` (or `deno run ... balda serve`) the OS
   * spawns the CLI under **node**. This means `runtime.type` reports "node"
   * even though the user's project – and the runtime they want for hot
   * reload – is bun or deno.
   *
   * To work around this we inspect the project's lockfiles and verify that
   * the corresponding runtime binary is available on the PATH. Only when no
   * bun/deno lockfile is found (or the binary is missing) do we fall back to
   * the current process runtime.
   */
  private static async detectEffectiveRuntime(): Promise<RunTimeType> {
    // If the CLI process itself is already bun or deno, trust it directly.
    if (this.runtime === "bun" || this.runtime === "deno") {
      return this.runtime;
    }

    const cwd = nativeCwd.getCwd();

    // Bun – check both the legacy binary lockfile and the new text lockfile.
    const hasBunLock =
      (await nativeFs.exists(nativePath.join(cwd, "bun.lockb"))) ||
      (await nativeFs.exists(nativePath.join(cwd, "bun.lock")));

    if (hasBunLock && this.isBinaryAvailable("bun")) {
      return "bun";
    }

    // Deno
    const hasDenoLock = await nativeFs.exists(
      nativePath.join(cwd, "deno.lock"),
    );

    if (hasDenoLock && this.isBinaryAvailable("deno")) {
      return "deno";
    }

    return "node";
  }

  /**
   * Checks whether a given CLI binary is reachable on the current PATH.
   * Works cross-platform by attempting `<binary> --version`.
   */
  private static isBinaryAvailable(binary: string): boolean {
    try {
      execSync(`${binary} --version`, {
        stdio: "ignore",
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  static async handle(): Promise<void> {
    const effectiveRuntime = await this.detectEffectiveRuntime();

    if (effectiveRuntime === "bun") {
      execSync(`bun run --watch ${this.entry}`, {
        stdio: "inherit",
        cwd: nativeCwd.getCwd(),
      });
      return;
    }

    if (effectiveRuntime === "deno") {
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
