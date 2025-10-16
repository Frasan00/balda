import { runtime } from "./runtime";

class NativeOs {
  async tmpdir(): Promise<string> {
    switch (runtime.type) {
      case "node":
      case "bun":
        const os = await import("node:os");
        return os.tmpdir();
      case "deno":
        return Deno.makeTempDir();
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeOs = new NativeOs();
