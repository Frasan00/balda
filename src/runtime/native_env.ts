import { runtime } from "./runtime.js";

export class NativeEnv {
  get(key: string): string | undefined {
    switch (runtime.type) {
      case "node":
      case "bun":
      case "deno":
        return process.env[key];
      default:
        throw new Error(`Unsupported runtime: ${runtime.type}`);
    }
  }

  getEnvironment(): Record<string, string> {
    switch (runtime.type) {
      case "node":
      case "deno":
      case "bun":
        return Object.fromEntries(
          Object.entries(process.env).filter(
            ([_, value]) => value !== undefined,
          ),
        ) as Record<string, string>;
    }
  }
}
