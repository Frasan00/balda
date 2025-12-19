import type { ZodAny } from "zod";
import { AjvStateManager } from "../../ajv/ajv.js";
import { AjvCompileParams } from "../../ajv/ajv_types.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import type { AsyncLocalStorageContext } from "../../plugins/async_local_storage/async_local_storage_types.js";
import type { FormFile } from "../../plugins/file/file_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";
import { NativeRequest } from "../../runtime/native_request.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";

/**
 * WeakMap to cache schema objects by reference, avoiding expensive JSON.stringify calls.
 * Uses Symbol for unique cache keys to prevent any potential counter overflow in long-running servers.
 */
const schemaRefCache = new WeakMap<object, symbol>();

/**
 * The request object.
 * This is the main object that is passed to the handler function.
 * It contains the request body, query parameters, files, cookies, etc.
 * It also contains the validation methods.
 */
export class Request<
  Params extends Record<string, string> = any,
> extends NativeRequest {
  static fromRequest(request: Request | NativeRequest): Request {
    return new Request(request.url, {
      method: request.method,
      body: request.body,
      headers: request.headers,
    });
  }

  private static compileAndValidate(
    inputSchema: ZodAny | AjvCompileParams[0],
    data: any,
    safe: boolean,
  ): any {
    let jsonSchema: any;
    let cacheKey: string;

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
   * Enrich native request with validation methods.
   */
  static enrichRequest(request: Request): Request {
    request.validate = (
      inputSchema: ZodAny | AjvCompileParams[0],
      safe: boolean = false,
    ): any => {
      return Request.compileAndValidate(inputSchema, request.body || {}, safe);
    };

    request.validateQuery = (
      inputSchema: ZodAny | AjvCompileParams[0],
      safe: boolean = false,
    ): any => {
      return Request.compileAndValidate(inputSchema, request.query || {}, safe);
    };

    request.validateAll = (
      inputSchema: ZodAny | AjvCompileParams[0],
      safe: boolean = false,
    ): any => {
      return Request.compileAndValidate(
        inputSchema,
        {
          ...(request.body ? { body: request.body } : {}),
          ...(request.query ? { query: request.query } : {}),
        },
        safe,
      );
    };

    request.file = (fieldName: string) => {
      return request.files.find((file) => file.formName === fieldName) ?? null;
    };

    request.files = [];
    request.saveSession = async () => {};
    request.destroySession = async () => {};
    request.session = {};
    request.cookies = {};
    request.cookie = (name: string) => {
      return request.cookies[name];
    };

    return request;
  }

  /**
   * The context of the request. Can be augmented extending AsyncLocalStorageContext interface
   * @asyncLocalStorage middleware is required
   * @example
   * ```ts
   * declare module "balda-js" {
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

  /**
   * The raw body of the request. Only available for POST, PUT, PATCH and DELETE requests.
   */
  declare rawBody?: ArrayBuffer;

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
   * The parsed body of the request
   */
  override body: any;

  /**
   * The validated body of the request.
   * @param inputSchema - The schema to validate the body against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return the original body if the validation fails instead of throwing an error.
   */
  validate(
    inputSchema: ZodAny | AjvCompileParams[0],
    safe: boolean = false,
  ): any {
    return Request.compileAndValidate(inputSchema, this.body || {}, safe);
  }

  /**
   * Validates the query string of the request.
   * @param inputSchema - The schema to validate the query against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return undefined if the validation fails instead of throwing an error.
   */
  validateQuery(
    inputSchema: ZodAny | AjvCompileParams[0],
    safe: boolean = false,
  ): any {
    return Request.compileAndValidate(inputSchema, this.query || {}, safe);
  }

  /**
   * Validates the body and query string of the request.
   * @param inputSchema - The schema to validate against (Zod schema or JSON Schema).
   * @param safe - If true, the function will return undefined if the validation fails instead of throwing an error.
   */
  validateAll(
    inputSchema: ZodAny | AjvCompileParams[0],
    safe: boolean = false,
  ): any {
    return Request.compileAndValidate(
      inputSchema,
      {
        ...(this.body ?? {}),
        ...(this.query ?? {}),
      },
      safe,
    );
  }
}
