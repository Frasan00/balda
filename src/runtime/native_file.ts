import fs from "node:fs";
import { runtime } from "./runtime";

export type ReadFileOptions = {
  encoding?: string;
  flag?: string;
};

class NativeFile {
  file(
    path: string,
    options?: ReadFileOptions,
  ): Buffer | Uint8Array | ArrayBuffer {
    switch (runtime.type) {
      // We do not use Bun api since we need this operation to be sync
      case "bun":
      case "node":
        return fs.readFileSync(path, options as any);
      case "deno":
        return Deno.readFileSync(path);
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeFile = new NativeFile();
