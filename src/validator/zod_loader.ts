/**
 * Manages synchronous loading of the Zod library at runtime.
 * Zod is a peer dependency and only loaded if Zod schemas are used.
 */
import type { ZodType } from "zod";
import { Zod3SchemaUsedError } from "../errors/zod3_schema_used.js";
import { Zod4NotInstalledError } from "../errors/zod4_not_installed_error.js";
import { requireFn } from "../package.js";
import type { JSONSchema } from "../plugins/swagger/swagger_types.js";

/**
 * Override callback for `z.toJSONSchema` — mirrors the `getOverride` function
 * from `@fastify/type-provider-zod` so that balda produces the same JSON
 * Schema representation as the Fastify Zod type provider (the de-facto
 * standard).
 *
 * Fixes types that Zod's `toJSONSchema` leaves as `{}` when
 * `unrepresentable: "any"` is used:
 *
 * - `z.date()` / `z.coerce.date()` → `{ type: "string", format: "date-time" }`
 * - `z.undefined()`             → `{ type: "null" }`
 * - `z.union` (empty members)    → filtered `anyOf` array
 *
 * @internal
 */
function zodToJSONOverride(
  io: "input" | "output",
): (ctx: { zodSchema: any; jsonSchema: any }) => void {
  return (ctx) => {
    const def = ctx.zodSchema?._zod?.def;

    // Date → string with date-time format (only for output, matching Fastify)
    if (def?.type === "date" && io === "output") {
      ctx.jsonSchema.type = "string";
      ctx.jsonSchema.format = "date-time";
    }

    // Undefined → null (only for output, matching Fastify)
    if (def?.type === "undefined" && io === "output") {
      ctx.jsonSchema.type = "null";
    }

    // Union — remove empty members left by unrepresentable: "any"
    if (def?.type === "union") {
      ctx.jsonSchema.anyOf = ctx.jsonSchema.anyOf?.filter(
        (s: object) => Object.keys(s).length > 0,
      );
    }
  };
}

/**
 * Options for {@link ZodLoader.toJSONSchema}.
 */
export interface ZodToJSONSchemaOptions {
  /**
   * Whether to extract the `"input"` or `"output"` type.
   *
   * - `"output"` (default) — The post-transform output type. Used for
   *   response schemas and response serializers.
   * - `"input"` — The pre-transform input type. Used for request schemas
   *   (body, query, headers) so the Swagger docs show what the client
   *   should send, not what the handler receives after transforms.
   *
   * This matches `@fastify/type-provider-zod`, which uses `"input"` for
   * request schemas and `"output"` for response schemas in its JSON
   * Schema transform.
   */
  io?: "input" | "output";
}

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
  static isZodSchema(value: any): value is ZodType {
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
   * Converts a Zod schema to JSON Schema.
   *
   * This method follows the same approach as `@fastify/type-provider-zod`
   * (the de-facto standard for Zod + JSON Schema integration):
   *
   * 1. Uses `z.toJSONSchema()` with `unrepresentable: "any"` so that types
   *    Zod can't natively represent (dates, transforms, etc.) produce `{}`
   *    instead of throwing.
   * 2. Uses an `override` callback to patch the `{}` placeholders for known
   *    types (date → `{ type: "string", format: "date-time" }`, undefined →
   *    `{ type: "null" }`, unions → filtered `anyOf`).
   * 3. Accepts an `io` option (`"input"` | `"output"`) so callers can
   *    extract the pre-transform input type (for request schemas in Swagger)
   *    or the post-transform output type (for response schemas).
   *
   * @param schema - The Zod schema to convert
   * @param options - Optional configuration (e.g. `io: "input"` for request schemas)
   * @returns The JSON Schema representation
   * @throws Zod4NotInstalledError if Zod v4 is not installed or toJSONSchema is not available
   * @throws Error if the schema is invalid or incompatible (Example using zod/v3)
   */
  static toJSONSchema(
    schema: ZodType,
    options?: ZodToJSONSchemaOptions,
  ): JSONSchema {
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

    const io = options?.io ?? "output";

    try {
      return zodModule.toJSONSchema(schema, {
        io,
        target: "openapi-3.0",
        unrepresentable: "any",
        override: zodToJSONOverride(io),
      }) as JSONSchema;
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
