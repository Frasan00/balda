/**
 * The options for the mock server, only one of body, formData, urlencoded can be provided
 */
export interface MockServerOptions {
  /**
   * The body of the request, if formData is provided, it will be ignored
   */
  body?: any;

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
   * The query parameters of the request, if provided, they will be merged with the query parameters from the path (precedence is given to the query parameters provided here)
   */
  query?: Record<string, string>;

  /**
   * The cookies of the request
   */
  cookies?: Record<string, string>;

  /**
   * The ip of the request
   */
  ip?: string;
}
