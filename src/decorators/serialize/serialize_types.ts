export interface SerializeOptions {
  /**
   * The status code to serialize the response body against (useful only for the documentation does not affect the actual response)
   * @default 200
   */
  status?: number;
  /**
   * Whether to use safe serialization (returns original data if serialization fails instead of throwing)
   * Advised to only set unsafe if development environment
   * @default true
   */
  safe?: boolean;
}
