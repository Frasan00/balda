import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import type { ZodAny } from "zod";
import { AjvStateManager } from "../../ajv/ajv.js";
import type { AjvCompileReturnType } from "../../ajv/ajv_types.js";
import type {
  RequestSchema,
  ValidatedData,
} from "../../decorators/validation/validate_types.js";
import type { AsyncLocalStorageContext } from "../../plugins/async_local_storage/async_local_storage_types.js";
import type { FormFile } from "../../plugins/body_parser/file/file_types.js";
import type { JSONSchema } from "../../plugins/swagger/swagger_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";
import { TypeBoxLoader } from "../../validator/typebox_loader.js";
import { validateSchema } from "../../validator/validator.js";
import { ZodLoader } from "../../validator/zod_loader.js";

/**
 * The request object with type-safe path parameters.
 * This is the main object that is passed to the handler function.
 * It contains the request body, query parameters, files, cookies, etc.
 * It also contains the validation methods.
 *
 * @template Params - The path parameters type (automatically extracted from route)
 */
export class Request<Params extends Record<string, string> = any> {
  /**
   * Creates a new request object from a Web API Request object.
   * Optimized with bulk property assignment to reduce per-request overhead.
   * @param request - The Web API Request object to create a new request object from.
   * @returns The new request object.
   */
  static fromRequest(request: globalThis.Request): Request {
    const baldaRequest = Object.assign(new Request(), {
      url: request.url,
      method: request.method,
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

    // Lazy loading the body from the Node.js IncomingMessage
    if (this.#nodeIncomingMessage && hasBodyMethod) {
      const webStream = Readable.toWeb(
        this.#nodeIncomingMessage,
      ) as unknown as ReadableStream;
      this.#webApiRequest = new globalThis.Request(this.url, {
        method: this.method,
        body: webStream,
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
      return this.#webApiRequest;
    }

    // Handle already parsed body or no body
    return new globalThis.Request(this.url, {
      method: this.method,
      ...(hasBodyMethod && this.body
        ? { body: this.body as BodyInit, duplex: "half" as const }
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
   * Converts any schema type to JSON Schema format and returns it with the appropriate prefix.
   * @param schema - The schema to convert
   * @returns Object with JSON Schema and prefix for caching
   * @internal
   */
  private static toJSONSchemaWithPrefix(schema: RequestSchema): {
    jsonSchema: JSONSchema;
    prefix: string;
  } {
    if (ZodLoader.isZodSchema(schema)) {
      return {
        jsonSchema: ZodLoader.toJSONSchema(schema as ZodAny),
        prefix: "zod_schema",
      };
    }

    if (TypeBoxLoader.isTypeBoxSchema(schema)) {
      return {
        jsonSchema: schema as JSONSchema,
        prefix: "typebox_schema",
      };
    }

    if (typeof schema === "object" && schema !== null) {
      return {
        jsonSchema: schema as JSONSchema,
        prefix: "json_schema",
      };
    }

    return {
      jsonSchema: { type: typeof schema } as JSONSchema,
      prefix: `primitive_${JSON.stringify(schema)}`,
    };
  }

  /**
   * Gets or compiles a schema using Ajv's internal caching.
   * Also stores the JSON Schema representation for Swagger documentation.
   * @param schema - The schema to compile
   * @returns Compiled Ajv validation function
   * @internal
   */
  private static getOrCompileSchema(
    schema: RequestSchema,
  ): AjvCompileReturnType {
    const { jsonSchema, prefix } = this.toJSONSchemaWithPrefix(schema);

    // Store JSON schema for Swagger documentation
    AjvStateManager.storeJsonSchema(jsonSchema, prefix);

    // Get or compile validator using Ajv's internal cache
    return AjvStateManager.getOrCompileValidator(jsonSchema, prefix);
  }

  /**
   * Compiles and validates the request data against the input schema.
   * @param inputSchema - The schema to validate the request data against (Zod, TypeBox, or plain JSON schema).
   * @param data - The request data to validate.
   * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original data.
   * @returns The validated data.
   */
  private static compileAndValidate<T extends RequestSchema>(
    inputSchema: RequestSchema,
    data: T,
    throwErrorOnValidationFail: boolean,
  ): ValidatedData<T> {
    const compiled = this.getOrCompileSchema(inputSchema);
    return validateSchema(compiled, data, throwErrorOnValidationFail);
  }

  /**
   * The original Web API Request object (if created from one)
   * @internal
   */
  #webApiRequest?: globalThis.Request;

  /**
   * The original Node.js IncomingMessage (for lazy body reading on Node.js runtime)
   * @internal
   */
  #nodeIncomingMessage?: IncomingMessage;

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
   *
   * Type is `unknown` to enforce validation before use.
   * Use validation methods or decorators to get typed body:
   * - `req.validate(schema)` - Validates and returns typed body
   * - `@validate.body(schema)` - Decorator for automatic validation
   *
   * @example
   * ```ts
   * // With validation
   * const validBody = req.validate(mySchema);
   * // Now validBody is properly typed
   *
   * // Without validation (not recommended)
   * const unsafeBody = req.body as MyType; // Requires type assertion
   * ```
   */
  body: unknown = undefined;

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
   * Lazy parsed - only parses URLSearchParams when accessed.
   *
   * ## Parsing Behavior
   *
   * ### Simple Queries (Optimized Fast Path)
   * For simple queries (< 50 chars, no `&`), uses optimized parsing:
   * - `?name=value` → `{ name: "value" }`
   * - `?key` → `{ key: "" }`
   * - Values are URL-decoded, keys are NOT decoded
   *
   * ### Complex Queries (Standard URLSearchParams)
   * For complex queries (≥ 50 chars or contains `&`), uses standard URLSearchParams:
   * - `?a=1&b=2` → `{ a: "1", b: "2" }`
   * - Both keys and values are URL-decoded
   *
   * ### Duplicate Keys
   * When the same key appears multiple times, **only the last value is kept**:
   * - `?id=1&id=2` → `{ id: "2" }` (NOT an array)
   *
   * ### Array Parameters
   * Array notation is **not** automatically handled:
   * - `?ids[]=1&ids[]=2` → `{ "ids[]": "2" }` (literal key "ids[]", not an array)
   * - Use validation schemas to parse array parameters if needed
   *
   * ### Special Characters
   * - Encoded values are decoded: `?name=John%20Doe` → `{ name: "John Doe" }`
   * - Plus signs in values become spaces (standard URL encoding)
   * - Keys are only decoded in complex queries (URLSearchParams path)
   *
   * ### Edge Cases
   * - Empty query string: `?` → `{}`
   * - No query string: → `{}`
   * - Encoded ampersands in values are handled correctly in complex queries:
   *   - `?key=value%26more&other=2` → `{ key: "value&more", other: "2" }`
   * - But may fail in simple query fast path if `&` appears in encoded form
   *
   * ## Type Safety
   *
   * Query values are **untyped strings**. For type-safe query parameters:
   * - Use `req.validateQuery(schema)` for runtime validation
   * - Use `@validate.query(schema)` decorator for automatic validation
   *
   * @example
   * ```ts
   * // Basic usage
   * req.query.name // string | undefined
   *
   * // With validation for type safety
   * const validated = req.validateQuery(z.object({
   *   page: z.coerce.number(),
   *   limit: z.coerce.number(),
   * }));
   * validated.page // number
   * ```
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
   * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original body.
   */
  validate<T extends RequestSchema>(
    inputSchema: T,
    throwErrorOnValidationFail: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(
      inputSchema,
      this.body || {},
      throwErrorOnValidationFail,
    );
  }

  /**
   * Validates the query string of the request.
   * @param inputSchema - The schema to validate the query against (Zod schema or JSON Schema).
   * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original query.
   */
  validateQuery<T extends RequestSchema>(
    inputSchema: T,
    throwErrorOnValidationFail: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(
      inputSchema,
      (this.query || {}) as Record<string, string>,
      throwErrorOnValidationFail,
    );
  }

  /**
   * Validates the body and query string of the request.
   * @param inputSchema - The schema to validate against (Zod schema or JSON Schema).
   * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original data.
   */
  validateAll<T extends RequestSchema>(
    inputSchema: T,
    throwErrorOnValidationFail: boolean = false,
  ): ValidatedData<T> {
    return Request.compileAndValidate(
      inputSchema,
      {
        ...(this.body ?? {}),
        ...((this.query as Record<string, string>) ?? {}),
      },
      throwErrorOnValidationFail,
    );
  }

  /**
   * Sets the Node.js IncomingMessage for lazy body reading.
   * Used internally by the Node.js server implementation.
   * @param req - The Node.js IncomingMessage
   * @internal
   */
  setNodeRequest(req: IncomingMessage): void {
    this.#nodeIncomingMessage = req;
  }
}
