import { runtime } from "./runtime";
import fs from "node:fs/promises";

class NativeFile {
  async file(path: string): Promise<Buffer | Uint8Array | ArrayBuffer> {
    switch (runtime.type) {
      case "bun":
        return Bun.file(path).arrayBuffer();
      case "node":
        return fs.readFile(path);
      case "deno":
        return Deno.readFile(path);
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeFile = new NativeFile();
