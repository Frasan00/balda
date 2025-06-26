import { RunTime } from "./runtime";

class NativeFs {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  async readFile(path: string): Promise<Uint8Array> {
    switch (this.runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(path);
        return new Uint8Array(buffer);
      case "bun":
        const arrayBuffer = await Bun.file(path).arrayBuffer();
        return new Uint8Array(arrayBuffer);
      case "deno":
        return new Uint8Array(await Deno.readFile(path));
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    switch (this.runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        await fs.writeFile(path, data);
        break;
      case "bun":
        await Bun.write(path, data);
        break;
      case "deno":
        await Deno.writeFile(path, data);
        break;
    }
  }

  async stat(path: string): Promise<{
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
    size: number;
  }> {
    switch (this.runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        const stats = await fs.stat(path);
        return {
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          isSymbolicLink: stats.isSymbolicLink(),
          size: stats.size,
        };
      case "bun":
        const bunStats = await Bun.file(path).stat();
        return {
          isDirectory: bunStats.isDirectory(),
          isFile: bunStats.isFile(),
          isSymbolicLink: bunStats.isSymbolicLink(),
          size: bunStats.size,
        };
      case "deno":
        const denoStats = await Deno.stat(path);
        return {
          isDirectory: denoStats.isDirectory,
          isFile: denoStats.isFile,
          isSymbolicLink: false,
          size: denoStats.size,
        };
    }
  }
}

export const nativeFs = new NativeFs();
