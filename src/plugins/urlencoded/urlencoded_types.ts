/**
 * Options for URL-encoded middleware
 */
export type UrlEncodedOptions = {
  /**
   * The maximum size of the URL-encoded body in bytes. Defaults to 1MB.
   */
  limit?: number;

  /**
   * Whether to parse extended syntax (objects and arrays). Defaults to false.
   */
  extended?: boolean;

  /**
   * The character encoding to use when parsing. Defaults to 'utf8'.
   */
  charset?: string;

  /**
   * Whether to allow empty values. Defaults to true.
   */
  allowEmpty?: boolean;

  /**
   * Maximum number of parameters to parse. Defaults to 1000.
   */
  parameterLimit?: number;
};
