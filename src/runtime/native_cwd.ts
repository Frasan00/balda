import { runtime } from "./runtime";

class NativeCwd {
  getCwd(): string {
    switch (runtime.type) {
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
