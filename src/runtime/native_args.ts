import { RunTime } from "./runtime";

class NativeArgs {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  /**
   * Gets CLI arguments, dynamically determining where they start
   * Handles different execution contexts (direct execution, tsx, ts-node, etc.)
   */
  getCliArgs(): string[] {
    switch (this.runtime.type) {
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

  /**
   * Finds the index of the actual script being executed
   * Handles cases like: node script.js, tsx script.ts, ts-node script.ts, yarn, yarn run, npx, etc.
   */
  private findScriptIndex(args: string[]): number {
    const scriptPatterns = [
      /\.(js|ts|mjs|cjs)$/,
      /^(tsx|ts-node|node|bun|yarn|npx|pnpm|npm)$/,
    ];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("-")) {
        continue;
      }

      if (arg === "yarn" && i + 1 < args.length && args[i + 1] === "run") {
        return i + 1;
      }

      const isScript = scriptPatterns.some((pattern) => pattern.test(arg));
      if (isScript) {
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
