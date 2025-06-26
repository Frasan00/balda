import { RunTime } from "./runtime";

class NativeFs {
  runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  async readFile(path: string): Promise<Buffer> {
    switch (this.runtime.type) {
      case "node":
        const fs = await import("fs/promises");
        return await fs.readFile(path);
      case "bun":
        const arrayBuffer = await Bun.file(path).arrayBuffer();
        return Buffer.from(arrayBuffer);
      case "deno":
        const file = await Deno.readFile(path);
        return Buffer.from(file);
    }
  }

  async writeFile(path: string, data: Buffer): Promise<void> {
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
}

export const nativeFs = new NativeFs();
