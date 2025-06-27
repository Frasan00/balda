import { RunTime } from "./runtime";
import { nativeCwd } from "./native_cwd";

export interface GlobOptions {
  /**
   * The current working directory
   */
  cwd?: string;
}

/**
 * Native glob implementation that works across Node.js, Bun, and Deno
 * Supports basic glob patterns: *, **, ?, [abc], {a,b,c}
 */
class NativeGlob {
  private runtime: RunTime;

  constructor() {
    this.runtime = new RunTime();
  }

  async glob(pattern: string, options: GlobOptions = {}): Promise<string[]> {
    switch (this.runtime.type) {
      // Deno supports glob from fs/promises natively
      case "deno":
      case "node":
        const { glob: fsGlob } = await import("fs/promises");
        const files = fsGlob(pattern, {
          cwd: options.cwd ?? nativeCwd.getCwd(),
        });

        const result: string[] = [];
        for await (const file of files) {
          result.push(file);
        }

        return result;
      case "bun":
        const glob = new Bun.Glob(pattern);
        const bunFiles = glob.scan({
          cwd: options.cwd ?? nativeCwd.getCwd(),
          absolute: true,
        });

        const bunResult: string[] = [];
        for await (const file of bunFiles) {
          bunResult.push(file);
        }

        return bunResult;
    }
  }
}

export const nativeGlob = new NativeGlob();
