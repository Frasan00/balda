import type { TSchema } from "@sinclair/typebox";
import type { ZodAny } from "zod";
import { AjvStateManager } from "../../ajv/ajv.js";
import { AjvCompileParams } from "../../ajv/ajv_types.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import type { AsyncLocalStorageContext } from "../../plugins/async_local_storage/async_local_storage_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";
import type { FormFile } from "../../plugins/body_parser/file/file_types.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";
import type {
  RequestSchema,
  ValidatedData,
} from "../../decorators/validation/validate_types.js";

/**
 * WeakMap to cache schema objects by reference, avoiding expensive JSON.stringify calls.
 * Uses Symbol for unique cache keys to prevent any potential counter overflow in long-running servers.
 * This cache is used for Zod, TypeBox, and plain JSON schemas.
 */
const schemaRefCache = new WeakMap<object, symbol>();

/**
 * The request object.
 * This is the main object that is passed to the handler function.
 * It contains the request body, query parameters, files, cookies, etc.
 * It also contains the validation methods.
 */
export class Request<Params extends Record<string, string> = any>
  extends globalThis.Request
{
  /**
   * Creates a new request object from a Web API Request object.
   * @param request - The Web API Request object to create a new request object from.
   * @returns The new request object.
   */
  static fromRequest(request: globalThis.Request): Request {
    return new Request(request.url, {
      method: request.method,
      body: request.body,
      headers: request.headers,
      signal: request.signal,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      integrity: request.integrity,
      keepalive: request.keepalive,
    });
  }

  /**
   * Compiles and validates the request data against the input schema.
   * @param inputSchema - The schema to validate the request data against (Zod, TypeBox, or plain JSON schema).
   * @param data - The request data to validate.
   * @param safe - If true, the function will return the original data if the validation fails instead of throwing an error.
   * @returns The validated data.
   */
  private static compileAndValidate<T extends RequestSchema>(
    inputSchema: RequestSchema,
    data: T,
    safe: boolean,
  ): ValidatedData<T> {
    let jsonSchema: any;
    let cacheKey: string;

    // Handle Zod schemas (need conversion to JSON Schema)
    if (ZodLoader.isZodSchema(inputSchema)) {
      const zodSchema = inputSchema as ZodAny;

      // Try to get cache key from WeakMap first
      let refKey = schemaRefCache.get(zodSchema);
      if (!refKey) {
        refKey = Symbol("zod_schema");
        schemaRefCache.set(zodSchema, refKey);
      }

      // Check if we already have a compiled schema
      let cached = openapiSchemaMap.get(refKey);
      if (cached) {
        return validateSchema(cached, data, safe);
      }

      // Convert to JSON schema and compile
      jsonSchema = zodSchema.toJSONSchema();
      const compiledSchema = AjvStateManager.ajv.compile(jsonSchema);
      openapiSchemaMap.set(refKey, compiledSchema);
      return validateSchema(compiledSchema, data, safe);
    }

    // Handle TypeBox schemas (already JSON Schema compliant)
    if (TypeBoxLoader.isTypeBoxSchema(inputSchema)) {
      const typeboxSchema = inputSchema as TSchema;

      // Try to get cache key from WeakMap first
      let refKey = schemaRefCache.get(typeboxSchema);
      if (!refKey) {
        refKey = Symbol("typebox_schema");
        schemaRefCache.set(typeboxSchema, refKey);
      }

      // Check if we already have a compiled schema
      let cached = openapiSchemaMap.get(refKey);
      if (cached) {
        return validateSchema(cached, data, safe);
      }

      // TypeBox schemas are already JSON Schema, compile directly
      const compiledSchema = AjvStateManager.ajv.compile(typeboxSchema);
      openapiSchemaMap.set(refKey, compiledSchema);
      return validateSchema(compiledSchema, data, safe);
    }

    // Handle plain JSON schemas
    const plainSchema = inputSchema as AjvCompileParams[0];

    // Try to use WeakMap cache for object references
    if (typeof plainSchema === "object" && plainSchema !== null) {
      let refKey = schemaRefCache.get(plainSchema);
      if (!refKey) {
        refKey = Symbol("json_schema");
        schemaRefCache.set(plainSchema, refKey);
      }

      const cached = openapiSchemaMap.get(refKey);
      if (cached) {
        return validateSchema(cached, data, safe);
      }

      const compiledSchema = AjvStateManager.ajv.compile(plainSchema);
      openapiSchemaMap.set(refKey, compiledSchema);
      return validateSchema(compiledSchema, data, safe);
    }

    // Fallback to JSON.stringify for primitives or edge cases
    cacheKey = JSON.stringify(plainSchema);
    const cached = openapiSchemaMap.get(cacheKey);
    if (cached) {
      return validateSchema(cached, data, safe);
    }

    const compiledSchema = AjvStateManager.ajv.compile(plainSchema);
    openapiSchemaMap.set(cacheKey, compiledSchema);
    return validateSchema(compiledSchema, data, safe);
  }

  /**
   * The raw Web API Request body.
   * @warning if using body parser middleware, this property will be read and the parsed body will be set to the `parsedBody` property.
   * @warning this body can be read once so be careful not to use it after the body parser middleware has been applied.
   */
  declare readonly body: globalThis.Request["body"];

  /**
   * The parsed body of the request from the body parser middleware.
   */
  declare parsedBody: any;

  /**
   * The context of the request. Can be augmented extending AsyncLocalStorageContext interface
   * @asyncLocalStorage middleware is required
   * @example
   * ```ts
   * declare module "balda" {
   *   interface AsyncLocalStorageContext {
   *     userId: string;
   *   }
   * }
   * ```
   */
  ctx: AsyncLocalStorageContext = {} as AsyncLocalStorageContext;

  /**
   * The file of the request.
   * @fileParser middleware is required
   */
  file: (fieldName: string) => FormFile | null = (fieldName: string) => {
    return this.files.find((file) => file.formName === fieldName) ?? null;
  };

  /**
   * The cookies of the request.
   * @cookie middleware is required
   */
  cookies: Record<string, string> = {};

  /**
   * The cookie of the request.
   * @cookie middleware is required
   */
  cookie: (name: string) => string | undefined = (name: string) => {
    return this.cookies[name];
  };

  /**
   * tells if the request has timed out.
   * @timeout middleware is required
   */
  timeout?: boolean;

  /**
   * The session of the request. Uses cookies to send the session id
   * @cookie middleware is required
   * @session middleware is required
   */
  session?: Record<string, any> = undefined;

  /**
   * The session of the request. Uses cookies to send the session id
   * @cookie middleware is required
   * @session middleware is required
   */
  saveSession: () => Promise<void> = async () => {};

  /**
   * The session of the request.
   * @cookie middleware is required
   * @session middleware is required
   */
  destroySession: () => Promise<void> = async () => {};

  /**
   * The ip address of the request.
   * Tries to get the ip address from the `x-forwarded-for` header. If not available, it will use the remote address from the request.
   */
  ip?: string;

  /**
   * The files of the request. Only available for multipart/form-data requests and if the file parser middleware is used.
   */
  files: FormFile[] = [];

  /**
   * The parameters of the request. Can be typed with a generic in the Request object
   * @example
   * ```ts
   * Request<{ id: string }>
   */
  params: Params = {} as Params;

  /**
   * The query parameters of the request.
   */
  query: Record<string, string> = {};

  declare private _id: string;

  /**
   * The id of the request.
   */
  get id(): string {
    if (!this._id) {
      this._id = nativeCrypto.randomUUID();
    }

    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  /**
   * The validated body of the request.
   * @param inputSchema - The schema to validate the body against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return the original body if the validation fails instead of throwing an error.
   */
  validate<T extends RequestSchema>(
    inputSchema: T,
    safe: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(inputSchema, this.parsedBody || {}, safe);
  }

  /**
   * Validates the query string of the request.
   * @param inputSchema - The schema to validate the query against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return undefined if the validation fails instead of throwing an error.
   */
  validateQuery<T extends RequestSchema>(
    inputSchema: T,
    safe: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(inputSchema, this.query || {}, safe);
  }

  /**
   * Validates the body and query string of the request.
   * @param inputSchema - The schema to validate against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return undefined if the validation fails instead of throwing an error.
   */
  validateAll<T extends RequestSchema>(
    inputSchema: T,
    safe: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(
      inputSchema,
      {
        ...(this.parsedBody ?? {}),
        ...(this.query ?? {}),
      },
      safe,
    );
  }
}
