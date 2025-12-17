import type { FormFile } from "../../plugins/file/file_types.js";
import { nativeCrypto } from "../../runtime/native_crypto.js";
import { z, type ZodType } from "zod";
import { NativeRequest } from "../../runtime/native_request.js";
import { validateSchema } from "../../validator/validator.js";
import type { AsyncLocalStorageContext } from "../../plugins/async_local_storage/async_local_storage_types.js";

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

  /**
   * Enrich native request with validation methods.
   */
  static enrichRequest(request: Request): Request {
    request.validate = <T extends ZodType>(
      inputSchema: T | ((schema: typeof z) => T),
      safe: boolean = false,
    ): z.infer<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(z);
      }

      return validateSchema(inputSchema, request.body || {}, safe);
    };

    request.validateQuery = <T extends ZodType>(
      inputSchema: T | ((schema: typeof z) => T),
      safe: boolean = false,
    ): z.infer<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(z);
      }

      return validateSchema(inputSchema, request.query || {}, safe);
    };

    request.validateAll = <T extends ZodType>(
      inputSchema: T | ((schema: typeof z) => T),
      safe: boolean = false,
    ): z.infer<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(z);
      }

      return validateSchema(
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
   * @param inputSchema - The schema to validate the body against.
   * @param safe - If true, the function will return the original body if the validation fails instead of throwing an error.
   */
  validate<T extends ZodType>(
    inputSchema: T | ((schema: typeof z) => T),
    safe: boolean = false,
  ): z.infer<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(z);
    }

    return validateSchema(inputSchema, this.body || {}, safe);
  }

  /**
   * Validates the query string of the request.
   */
  validateQuery<T extends ZodType>(
    inputSchema: T | ((schema: typeof z) => T),
    safe: boolean = false,
  ): z.infer<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(z);
    }

    return validateSchema(inputSchema, this.query || {}, safe);
  }

  /**
   * Validates the body and query string of the request.
   */
  validateAll<T extends ZodType>(
    inputSchema: T | ((schema: typeof z) => T),
    safe: boolean = false,
  ): z.infer<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(z);
    }

    return validateSchema(
      inputSchema,
      {
        ...(this.body ?? {}),
        ...(this.query ?? {}),
      },
      safe,
    );
  }
}
