/**
 * Type-safe options for the mock server
 * @template TBody - The request body type
 * @template TQuery - The query parameters type
 */
export interface MockServerOptions<
  TBody = any,
  TQuery extends Record<string, string> = any,
> {
  /**
   * The body of the request (typed)
   */
  body?: TBody;

  /**
   * The form data of the request
   */
  formData?: FormData;

  /**
   * The urlencoded body of the request
   */
  urlencoded?: Record<string, string>;

  /**
   * The headers of the request
   */
  headers?: Record<string, string>;

  /**
   * The query parameters of the request (typed)
   */
  query?: TQuery;

  /**
   * The cookies of the request
   */
  cookies?: Record<string, string>;

  /**
   * The ip of the request
   */
  ip?: string;
}
