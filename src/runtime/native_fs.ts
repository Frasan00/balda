import { runtime } from "./runtime";

class NativeFs {
  async readFile(path: string): Promise<Uint8Array> {
    switch (runtime.type) {
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
    switch (runtime.type) {
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
    switch (runtime.type) {
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

  async unlink(path: string): Promise<void> {
    switch (runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        await fs.unlink(path);
        break;
      case "bun":
        await Bun.file(path).delete();
        break;
      case "deno":
        await Deno.remove(path);
        break;
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeFs = new NativeFs();
