import { type Static, type TSchema, Type } from "@sinclair/typebox";
import { validateSchema } from "src/validator/validator";
import { NativeRequest } from "../../runtime/native_request";

export class Request extends NativeRequest {
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
    request.validate = <T extends TSchema>(
      inputSchema: T | ((schema: typeof Type) => T),
      safe: boolean = false
    ): Static<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(Type);
      }

      return validateSchema(inputSchema, request.body, safe);
    };

    request.validateQuery = <T extends TSchema>(
      inputSchema: T | ((schema: typeof Type) => T),
      safe: boolean = false
    ): Static<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(Type);
      }

      return validateSchema(inputSchema, request.query, safe);
    };

    request.validateAll = <T extends TSchema>(
      inputSchema: T | ((schema: typeof Type) => T),
      safe: boolean = false
    ): Static<T> => {
      if (typeof inputSchema === "function") {
        inputSchema = inputSchema(Type);
      }

      return validateSchema(
        inputSchema,
        {
          body: request.body,
          query: request.query,
        },
        safe
      );
    };

    return request;
  }

  /**
   * The parameters of the request.
   */
  params: Record<string, string> = {};

  /**
   * The query parameters of the request.
   */
  query: Record<string, string> = {};

  /**
   * The raw body of the request. Only available for POST, PUT, PATCH and DELETE requests.
   */
  declare rawBody?: ArrayBuffer;

  /**
   * The parsed body of the request.
   */
  override body: any;

  /**
   * The validated body of the request.
   * @param inputSchema - The schema to validate the body against.
   * @param safe - If true, the function will return the original body if the validation fails instead of throwing an error.
   */
  validate<T extends TSchema>(
    inputSchema: T | ((schema: typeof Type) => T),
    safe: boolean = false
  ): Static<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(Type);
    }

    return validateSchema(inputSchema, this.body, safe);
  }

  /**
   * Validates the query string of the request.
   */
  validateQuery<T extends TSchema>(
    inputSchema: T | ((schema: typeof Type) => T),
    safe: boolean = false
  ): Static<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(Type);
    }

    return validateSchema(inputSchema, this.query, safe);
  }

  /**
   * Validates the body and query string of the request.
   */
  validateAll<T extends TSchema>(
    inputSchema: T | ((schema: typeof Type) => T),
    safe: boolean = false
  ): Static<T> {
    if (typeof inputSchema === "function") {
      inputSchema = inputSchema(Type);
    }

    return validateSchema(
      inputSchema,
      {
        body: this.body,
        query: this.query,
      },
      safe
    );
  }
}
