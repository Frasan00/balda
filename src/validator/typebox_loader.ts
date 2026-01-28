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
   */
  static isTypeBoxSchema(value: any): value is TSchema {
    try {
      this.load();
    } catch {
      return false;
    }

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
