/**
 * Manages synchronous loading of the Zod library at runtime.
 * Zod is a peer dependency and only loaded if Zod schemas are used.
 */
import type { ZodAny } from "zod";
import { Zod4NotInstalledError } from "../errors/zod4_not_installed_error.js";
import { requireFn } from "../package.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";
import { Zod3SchemaUsedError } from "../errors/zod3_schema_used.js";

export class ZodLoader {
  private static zodModule: typeof import("zod") | null = null;

  /**
   * Cache of objects confirmed as Zod schemas to avoid repeated property checks.
   */
  private static zodSchemaCache = new WeakSet<object>();

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
      this.ensureZodV4();
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
   * Results are cached in a WeakSet to avoid repeated property lookups
   */
  static isZodSchema(value: any): value is ZodAny {
    try {
      this.load();
    } catch {
      return false;
    }

    if (typeof value !== "object" || value === null) {
      return false;
    }

    // Fast path: check cache first
    if (this.zodSchemaCache.has(value)) {
      return true;
    }

    // Slow path: perform full type detection
    const isZod =
      "_def" in value &&
      typeof value.parse === "function" &&
      typeof value.safeParse === "function";

    // Cache positive results to avoid repeated property checks
    if (isZod) {
      this.zodSchemaCache.add(value);
    }

    return isZod;
  }

  /**
   * Ensures that Zod v4 is installed with toJSONSchema support
   * @throws Zod4NotInstalledError if Zod v4 is not installed
   */
  static ensureZodV4(): void {
    const zodModule = this.zodModule?.z;
    if (!zodModule) {
      throw new Zod4NotInstalledError();
    }

    if (!("toJSONSchema" in zodModule)) {
      throw new Zod4NotInstalledError();
    }
  }

  /**
   * Converts a Zod schema to JSON Schema using Zod v4's toJSONSchema method
   * @param schema - The Zod schema to convert
   * @returns The JSON Schema representation
   * @throws Zod4NotInstalledError if Zod v4 is not installed or toJSONSchema is not available
   * @throws Error if the schema is invalid or incompatible (Example using zod/v3)
   */
  static toJSONSchema(schema: ZodAny): JSONSchema {
    this.load();
    this.ensureZodV4();

    const zodModule = this.zodModule?.z;
    if (!zodModule?.toJSONSchema) {
      throw new Zod4NotInstalledError();
    }

    if (!schema || typeof schema !== "object" || !("_def" in schema)) {
      throw new Error(
        "Invalid Zod schema provided. Make sure you're using Zod v4 schemas. " +
          "If you're importing from 'zod/v3', change to 'zod' or '{ z } from \"zod\"'.",
      );
    }

    try {
      return zodModule.toJSONSchema(schema) as JSONSchema;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot read properties of undefined")
      ) {
        throw new Zod3SchemaUsedError(error);
      }
      throw error;
    }
  }
}
