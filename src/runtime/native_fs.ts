import { runtime } from "./runtime.js";

class NativeFs {
  async mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number | string },
  ): Promise<void> {
    switch (runtime.type) {
      case "bun":
      case "node":
        const fs = await import("node:fs/promises");
        await fs.mkdir(path, {
          recursive: options?.recursive ?? false,
          mode: options?.mode,
        });
        break;
      case "deno":
        if (typeof options?.mode === "string") {
          options.mode = Number.parseInt(options.mode);
        }

        await Deno.mkdir(path, {
          recursive: options?.recursive ?? false,
          mode: options?.mode,
        });
        break;
    }
  }

  async exists(path: string): Promise<boolean> {
    switch (runtime.type) {
      case "node":
        const fs = await import("fs");
        return fs.existsSync(path);
      case "bun":
        const bunFs = await import("fs");
        return bunFs.existsSync(path);
      case "deno":
        return Deno.stat(path)
          .then(() => true)
          .catch(() => false);
      default:
        throw new Error("Unsupported runtime");
    }
  }

  async readFile(
    path: string,
    options?: { encoding?: "utf8" },
  ): Promise<Uint8Array | string> {
    switch (runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        const data = await fs.readFile(path, {
          encoding: options?.encoding ?? null,
        });

        if (options?.encoding === "utf8") {
          return data as string;
        }

        return new Uint8Array(data as Buffer);
      case "bun":
        const arrayBuffer = Bun.file(path);
        if (options?.encoding === "utf8") {
          return arrayBuffer.text();
        }

        return new Uint8Array(await arrayBuffer.arrayBuffer());
      case "deno":
        const denoBuffer = await Deno.readFile(path);
        if (options?.encoding === "utf8") {
          return new TextDecoder().decode(denoBuffer);
        }

        return new Uint8Array(denoBuffer);
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
        const bunFs = await import("fs/promises");
        const bunStats = await bunFs.stat(path);
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

  async streamFile(path: string): Promise<ReadableStream> {
    switch (runtime.type) {
      case "node":
        const fs = await import("fs");
        const { Readable } = await import("stream");
        const nodeStream = fs.createReadStream(path);
        return Readable.toWeb(nodeStream) as unknown as ReadableStream;

      case "bun":
        return Bun.file(path).stream();
      case "deno":
        const denoFile = await Deno.open(path);
        return denoFile.readable;
      default:
        throw new Error("Unsupported runtime");
    }
  }
}

export const nativeFs = new NativeFs();
