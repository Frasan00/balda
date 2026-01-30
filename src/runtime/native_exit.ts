import { runtime } from "./runtime.js";

class NativeExit {
  exit(code: number): void {
    switch (runtime.type) {
      case "bun":
      case "node":
        process.exit(code);
      case "deno":
        Deno.exit(code);
      default:
        throw new Error(`Unsupported runtime: ${runtime.type}`);
    }
  }
}

export const nativeExit = new NativeExit();
