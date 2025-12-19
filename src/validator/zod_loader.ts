/**
 * Manages lazy loading of the Zod library at runtime.
 * Zod is a peer dependency and only loaded if Zod schemas are used.
 */
import type { ZodType } from "zod";

export class ZodLoader {
  private static zodModule: typeof import("zod") | null = null;
  private static loadPromise: Promise<typeof import("zod")> | null = null;

  /**
   * Lazily loads the Zod library at runtime.
   * @throws Error if Zod is not installed
   */
  static async load(): Promise<typeof import("zod")> {
    if (this.zodModule) {
      return this.zodModule;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        this.zodModule = await import("zod");
        return this.zodModule;
      } catch (error) {
        throw new Error(
          "Zod is not installed. Install it with: npm install zod\n" +
            "Zod is a peer dependency required when using Zod schemas for validation.",
        );
      }
    })();

    return this.loadPromise;
  }

  /**
   * Gets the loaded Zod module synchronously.
   * @throws Error if Zod has not been loaded yet
   */
  static get(): typeof import("zod") {
    if (!this.zodModule) {
      throw new Error(
        "Zod has not been loaded yet. Call ZodLoader.load() first.",
      );
    }
    return this.zodModule;
  }

  /**
   * Checks if a value is a Zod schema
   */
  static isZodSchema(value: any): value is ZodType {
    const isZod =
      typeof value === "object" &&
      value !== null &&
      "_def" in value &&
      typeof value.parse === "function" &&
      typeof value.safeParse === "function";

    if (isZod && !("toJSONSchema" in value)) {
      throw new Error(
        "Zod4 is required with the toJSONSchema() method in order to work. Install it with: npm install zod with minimum version 4.0.0",
      );
    }

    return isZod;
  }
}
