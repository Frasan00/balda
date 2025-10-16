// Both Deno and Bun are compatible with path api
import path from "path";
import { runtime } from "./runtime";

class NativePath {
  join(...paths: string[]): string {
    switch (runtime.type) {
      case "node":
      case "bun":
      case "deno":
        return path.join(...paths);
      default:
        throw new Error("Unsupported runtime");
    }
  }

  extName(inputPath: string): string {
    switch (runtime.type) {
      case "bun":
      case "node":
      case "deno":
        return path.extname(inputPath);
      default:
        throw new Error("Unsupported runtime");
    }
  }

  resolve(...paths: string[]): string {
    switch (runtime.type) {
      case "bun":
      case "node":
      case "deno":
        return path.resolve(...paths);
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativePath = new NativePath();
