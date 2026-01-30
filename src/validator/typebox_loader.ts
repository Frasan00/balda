/**
 * Manages synchronous loading of the TypeBox library at runtime.
 * TypeBox is a peer dependency and only loaded if TypeBox schemas are used.
 */
import type { TSchema } from "@sinclair/typebox";
import { TypeBoxNotInstalledError } from "../errors/typebox_not_installed_error.js";
import { requireFn } from "../package.js";

export class TypeBoxLoader {
  private static typeboxModule: typeof import("@sinclair/typebox") | null =
    null;

  /**
   * Cache of objects confirmed as TypeBox schemas to avoid repeated symbol lookups.
   */
  private static typeboxSchemaCache = new WeakSet<object>();

  /**
   * Synchronously loads the TypeBox library at runtime.
   * @throws TypeBoxNotInstalledError if TypeBox is not installed
   */
  private static load(): typeof import("@sinclair/typebox") {
    if (this.typeboxModule) {
      return this.typeboxModule;
    }

    try {
      this.typeboxModule = requireFn(
        "@sinclair/typebox",
      ) as typeof import("@sinclair/typebox");
      return this.typeboxModule;
    } catch (error) {
      throw new TypeBoxNotInstalledError();
    }
  }

  /**
   * Gets the loaded TypeBox module synchronously.
   * @throws TypeBoxNotInstalledError if TypeBox is not installed
   */
  static get(): typeof import("@sinclair/typebox") {
    return this.load();
  }

  /**
   * Checks if a value is a TypeBox schema
   * TypeBox schemas have a [Kind] symbol property
   * Results are cached in a WeakSet to avoid repeated Object.getOwnPropertySymbols calls
   */
  static isTypeBoxSchema(value: any): value is TSchema {
    try {
      this.load();
    } catch {
      return false;
    }

    if (typeof value !== "object" || value === null) {
      return false;
    }

    // Fast path: check cache first
    if (this.typeboxSchemaCache.has(value)) {
      return true;
    }

    // Slow path: perform full type detection
    const isTypeBox =
      "type" in value &&
      Object.getOwnPropertySymbols(value).some(
        (sym) => sym.toString() === "Symbol(TypeBox.Kind)",
      );

    // Cache positive results to avoid repeated symbol lookups
    if (isTypeBox) {
      this.typeboxSchemaCache.add(value);
    }

    return isTypeBox;
  }
}
