export interface SerializeOptions {
  /**
   * The status code to serialize the response body against (useful only for the documentation does not affect the actual response status)
   * @default 200
   */
  status?: number;
  /**
   * Whether to throw an error when response validation fails.
   * When true, throws ValidationError if response doesn't match schema.
   * When false, skips validation (returns original data).
   * Advised to set to true in development environment.
   * @default false
   */
  throwErrorOnValidationFail?: boolean;
}
