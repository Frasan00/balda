/**
 * Manages lazy loading of the TypeBox library at runtime.
 * TypeBox is a peer dependency and only loaded if TypeBox schemas are used.
 */
import type { TSchema } from "@sinclair/typebox";

export class TypeBoxLoader {
  private static typeboxModule: typeof import("@sinclair/typebox") | null =
    null;
  private static loadPromise: Promise<
    typeof import("@sinclair/typebox")
  > | null = null;

  /**
   * Lazily loads the TypeBox library at runtime.
   * @throws Error if TypeBox is not installed
   */
  static async load(): Promise<typeof import("@sinclair/typebox")> {
    if (this.typeboxModule) {
      return this.typeboxModule;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        this.typeboxModule = await import("@sinclair/typebox");
        return this.typeboxModule;
      } catch (error) {
        throw new Error(
          "TypeBox is not installed. Install it with: npm install @sinclair/typebox\n" +
            "TypeBox is a peer dependency required when using TypeBox schemas for validation.",
        );
      }
    })();

    return this.loadPromise;
  }

  /**
   * Gets the loaded TypeBox module synchronously.
   * @throws Error if TypeBox has not been loaded yet
   */
  static get(): typeof import("@sinclair/typebox") {
    if (!this.typeboxModule) {
      throw new Error(
        "TypeBox has not been loaded yet. Call TypeBoxLoader.load() first.",
      );
    }
    return this.typeboxModule;
  }

  /**
   * Checks if a value is a TypeBox schema
   * TypeBox schemas have a [Kind] symbol property
   */
  static isTypeBoxSchema(value: any): value is TSchema {
    return (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      Object.getOwnPropertySymbols(value).some(
        (sym) => sym.toString() === "Symbol(TypeBox.Kind)",
      )
    );
  }
}
