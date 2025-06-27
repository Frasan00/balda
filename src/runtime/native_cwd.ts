import { RunTime } from "./runtime";

class NativeCwd {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  getCwd(): string {
    switch (this.runtime.type) {
      case "node":
      case "bun":
        return process.cwd();
      case "deno":
        return Deno.cwd();
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeCwd = new NativeCwd();
