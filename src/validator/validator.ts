import { ValidationError } from "ajv";
import { AjvCompileReturnType } from "../ajv/ajv_types.js";

export { ValidationError } from "ajv";

/**
 * Validates data against an AJV schema synchronously.
 *
 * @param inputSchema - The compiled AJV validator function
 * @param data - The data to validate
 * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original data. Default is true
 * @returns The validated data, or the original data if throwErrorOnValidationFail is false
 * @throws ValidationError if validation fails and throwErrorOnValidationFail is true
 */
export const validateSchema = <T = unknown>(
  inputSchema: AjvCompileReturnType,
  data: unknown,
  throwErrorOnValidationFail: boolean = true,
): T => {
  const isValid = inputSchema(data);
  if (!isValid) {
    if (throwErrorOnValidationFail) {
      throw new ValidationError(inputSchema.errors || []);
    }

    // When throwOnFail is false, return data as T (caller's responsibility)
    return data as T;
  }

  return data as T;
};
