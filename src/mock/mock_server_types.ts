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
   * The headers of the request
   */
  headers?: Record<string, string>;

  /**
   * The query parameters of the request
   */
  query?: Record<string, string>;

  /**
   * The cookies of the request
   */
  cookies?: Record<string, string>;

  /**
   * The params of the request
   */
  params?: Record<string, string>;

  /**
   * The ip of the request
   */
  ip?: string;
};
