import { runtime } from "src/runtime/runtime";

export class NativeEnv {
  get(key: string): string {
    switch (runtime.type) {
      case "node":
        return process.env[key] ?? "";
      case "bun":
        return Bun.env[key] ?? "";
      case "deno":
        return Deno.env.get(key) ?? "";
      default:
        throw new Error(`Unsupported runtime: ${runtime.type}`);
    }
  }

  getEnvironment(): Record<string, string> {
    switch (runtime.type) {
      case "node":
        return Object.fromEntries(
          Object.entries(process.env).filter(
            ([_, value]) => value !== undefined,
          ),
        ) as Record<string, string>;
      case "bun":
        return Object.fromEntries(
          Object.entries(Bun.env).filter(([_, value]) => value !== undefined),
        ) as Record<string, string>;
      case "deno":
        return Deno.env.toObject();
    }
  }
}
