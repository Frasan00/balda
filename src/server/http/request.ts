import type { TSchema } from "@sinclair/typebox";
import type { ZodAny } from "zod";
import { AjvStateManager } from "../../ajv/ajv.js";
import { AjvCompileParams } from "../../ajv/ajv_types.js";
import { openapiSchemaMap } from "../../ajv/openapi_schema_map.js";
import type {
  RequestSchema,
  ValidatedData,
} from "../../decorators/validation/validate_types.js";
import type { AsyncLocalStorageContext } from "../../plugins/async_local_storage/async_local_storage_types.js";
import type { FormFile } from "../../plugins/body_parser/file/file_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";

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
export class Request<Params extends Record<string, string> = any> {
  /**
   * Creates a new request object from a Web API Request object.
   * Optimized to inline body check and avoid unnecessary property spreading.
   * @param request - The Web API Request object to create a new request object from.
   * @returns The new request object.
   */
  static fromRequest(request: globalThis.Request): Request {
    const baldaRequest = new Request();
    const method = request.method;

    baldaRequest.url = request.url;
    baldaRequest.method = method;
    baldaRequest.headers = request.headers;
    baldaRequest.signal = request.signal;
    baldaRequest.referrer = request.referrer;
    baldaRequest.referrerPolicy = request.referrerPolicy;
    baldaRequest.mode = request.mode;
    baldaRequest.credentials = request.credentials;
    baldaRequest.cache = request.cache;
    baldaRequest.redirect = request.redirect;
    baldaRequest.integrity = request.integrity;
    baldaRequest.keepalive = request.keepalive;
    baldaRequest.#webApiRequest = request;

    return baldaRequest;
  }

  /**
   * Convert this request back to a Web API Request object.
   * Useful for passing to external libraries that expect standard Request objects.
   * @returns A Web API Request object
   */
  toWebApi(): globalThis.Request {
    if (this.#webApiRequest) {
      return this.#webApiRequest;
    }

    const hasBodyMethod =
      this.method === "POST" ||
      this.method === "PUT" ||
      this.method === "PATCH";

    return new globalThis.Request(this.url, {
      method: this.method,
      ...(hasBodyMethod && this.body
        ? { body: this.body as any, duplex: "half" as const }
        : {}),
      headers: this.headers,
      signal: this.signal,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      mode: this.mode,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      integrity: this.integrity,
      keepalive: this.keepalive,
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
   * The original Web API Request object (if created from one)
   * @internal
   */
  #webApiRequest?: globalThis.Request;

  /**
   * The URL of the request
   */
  url: string = "";

  /**
   * The HTTP method of the request
   */
  method: string = "GET";

  /**
   * The headers of the request
   */
  headers: globalThis.Headers = new Headers();

  /**
   * The signal for aborting the request
   */
  signal?: AbortSignal;

  /**
   * The referrer of the request
   */
  referrer?: string;

  /**
   * The referrer policy of the request
   */
  referrerPolicy?: ReferrerPolicy;

  /**
   * The mode of the request
   */
  mode?: RequestMode;

  /**
   * The credentials mode of the request
   */
  credentials?: RequestCredentials;

  /**
   * The cache mode of the request
   */
  cache?: RequestCache;

  /**
   * The redirect mode of the request
   */
  redirect?: RequestRedirect;

  /**
   * The integrity of the request
   */
  integrity?: string;

  /**
   * The keepalive flag of the request
   */
  keepalive?: boolean;

  /**
   * The parsed body of the request from the body parser middleware.
   * If body parser middleware is not used, this will be undefined.
   */
  body: any = undefined;

  /**
   * Flag indicating if the body has been read/parsed
   */
  bodyUsed: boolean = false;

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
   * Private properties for lazy query parsing
   */
  #query?: Record<string, string>;
  #queryString?: string;
  #queryParsed = false;

  /**
   * The query parameters of the request.
   * Lazy parsed - only parses URLSearchParams when accessed
   */
  get query(): Record<string, string> {
    if (this.#queryParsed) {
      return this.#query!;
    }

    if (!this.#queryString || this.#queryString === "") {
      this.#query = {};
    } else {
      // Simple cases
      if (this.#queryString.length < 50 && !this.#queryString.includes("&")) {
        const eqIndex = this.#queryString.indexOf("=");
        if (eqIndex === -1) {
          this.#query = { [this.#queryString]: "" };
        } else {
          const key = this.#queryString.slice(0, eqIndex);
          const value = decodeURIComponent(
            this.#queryString.slice(eqIndex + 1),
          );
          this.#query = { [key]: value };
        }
      } else {
        // Complex query with multiple parameters
        this.#query = Object.fromEntries(
          new URLSearchParams(this.#queryString),
        );
      }
    }

    this.#queryParsed = true;
    return this.#query!;
  }

  set query(value: Record<string, string>) {
    this.#query = value;
    this.#queryParsed = true;
  }

  /**
   * Set the raw query string (called by server implementations)
   * @internal
   */
  setQueryString(queryString: string): void {
    this.#queryString = queryString;
    this.#queryParsed = false;
    this.#query = undefined;
  }

  #id?: string;

  /**
   * The id of the request.
   */
  get id(): string {
    if (!this.#id) {
      this.#id = nativeCrypto.randomUUID();
    }

    return this.#id;
  }

  set id(value: string) {
    this.#id = value;
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
    return Request.compileAndValidate(inputSchema, this.body || {}, safe);
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
        ...(this.body ?? {}),
        ...(this.query ?? {}),
      },
      safe,
    );
  }
}
