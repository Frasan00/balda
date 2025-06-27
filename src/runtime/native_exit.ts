import { RunTime } from "./runtime";

class NativeExit {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  exit(code: number): void {
    switch (this.runtime.type) {
      case "bun":
      case "node":
        process.exit(code);
      case "deno":
        Deno.exit(code);
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeExit = new NativeExit();
