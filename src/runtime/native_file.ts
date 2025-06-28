import { RunTime } from "./runtime";
import fs from "node:fs/promises";

class NativeFile {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  file(path: string): any {
    switch (this.runtime.type) {
      case "bun":
        return Bun.file(path);
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
