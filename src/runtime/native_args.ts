import { runtime } from "./runtime";

class NativeArgs {
  /**
   * Gets CLI arguments, dynamically determining where they start
   * Handles different execution contexts (direct execution, tsx, ts-node, etc.)
   */
  getCliArgs(): string[] {
    switch (runtime.type) {
      case "bun":
        return this.getBunArgs();
      case "node":
        return this.getNodeArgs();
      case "deno":
        return Deno.args;
      default:
        throw new Error("Unsupported runtime");
    }
  }

  /**
   * Gets Bun arguments, handling different execution contexts
   */
  private getBunArgs(): string[] {
    const args = Bun.argv;
    const scriptIndex = this.findScriptIndex(args);
    return args.slice(scriptIndex + 1);
  }

  /**
   * Gets Node.js arguments, handling different execution contexts
   */
  private getNodeArgs(): string[] {
    const args = process.argv;
    const scriptIndex = this.findScriptIndex(args);
    return args.slice(scriptIndex + 1);
  }

  private findScriptIndex(args: string[]): number {
    if (args.length >= 3 && args[1].includes(".bin/")) {
      return 1;
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argBasename = arg.split("/").pop() || arg;

      if (arg.startsWith("-")) {
        continue;
      }

      if (
        argBasename === "yarn" &&
        i + 1 < args.length &&
        args[i + 1] === "run"
      ) {
        return i + 1;
      }

      if (argBasename === "npx" && i + 1 < args.length) {
        return i + 1;
      }

      if (argBasename === "yarn" || argBasename === "pnpm") {
        return i;
      }

      if (
        argBasename === "npm" &&
        i + 1 < args.length &&
        args[i + 1] === "run"
      ) {
        return i + 1;
      }

      if (
        argBasename === "bun" &&
        i + 1 < args.length &&
        args[i + 1] === "run"
      ) {
        return i + 1;
      }

      if (/\.(js|ts|mjs|cjs)$/.test(arg)) {
        return i;
      }

      if (/^(tsx|ts-node|node|bun)$/.test(argBasename)) {
        for (let j = i + 1; j < args.length; j++) {
          if (!args[j].startsWith("-") && /\.(js|ts|mjs|cjs)$/.test(args[j])) {
            return j;
          }
        }
        return i;
      }
    }

    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i];
      if (!arg.startsWith("-")) {
        return i;
      }
    }

    return 1;
  }
}

export const nativeArgs = new NativeArgs();
