import { RunTime } from "./runtime";

class NativeCwd {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  async getCwd(): Promise<string> {
    switch (this.runtime.type) {
      case "node":
        return process.cwd();
      case "bun":
        const { $ } = await import("bun");
        return $.cwd().toString();
      case "deno":
        return Deno.cwd();
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeCwd = new NativeCwd();
