/**
 * Manages synchronous loading of the Zod library at runtime.
 * Zod is a peer dependency and only loaded if Zod schemas are used.
 */
import type { ZodAny } from "zod";
import { requireFn } from "../package.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";

export class ZodLoader {
  private static zodModule: typeof import("zod") | null = null;

  /**
   * Synchronously loads the Zod library at runtime.
   * @throws Error if Zod is not installed
   */
  private static load(): typeof import("zod") {
    if (this.zodModule) {
      return this.zodModule;
    }

    try {
      this.zodModule = requireFn("zod") as typeof import("zod");
      return this.zodModule;
    } catch (error) {
      throw new Error(
        "Zod is not installed. Install it with: npm install zod\n" +
          "Zod is a peer dependency required when using Zod schemas for validation.",
      );
    }
  }

  /**
   * Gets the loaded Zod module synchronously.
   * @throws Error if Zod is not installed
   */
  static get(): typeof import("zod") {
    return this.load();
  }

  /**
   * Checks if a value is a Zod schema
   */
  static isZodSchema(value: any): value is ZodAny {
    this.load();
    const isZod =
      typeof value === "object" &&
      value !== null &&
      "_def" in value &&
      typeof value.parse === "function" &&
      typeof value.safeParse === "function";

    const zodModule = this.zodModule?.z;
    if (isZod && zodModule && !("toJSONSchema" in zodModule)) {
      throw new Error(
        "Zod4 is required with the toJSONSchema() method in order to work. Install it with: npm install zod with minimum version 4.0.0",
      );
    }

    return isZod;
  }

  static toJSONSchema(schema: ZodAny): JSONSchema {
    this.load();
    return this.zodModule?.z?.toJSONSchema?.(schema) as JSONSchema;
  }
}
