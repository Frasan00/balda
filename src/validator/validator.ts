import { ValidationError } from "ajv";
import { AjvCompileReturnType } from "../ajv/ajv_types.js";

/**
 * Validates data against an AJV schema synchronously.
 *
 * @param inputSchema - The compiled AJV validator function
 * @param data - The data to validate
 * @param throwErrorOnValidationFail - If true, throws ValidationError on validation failure. If false, returns the original data.
 * @returns The validated data, or the original data if throwErrorOnValidationFail is false
 * @throws ValidationError if validation fails and throwErrorOnValidationFail is true
 */
export const validateSchema = (
  inputSchema: AjvCompileReturnType,
  data: any,
  throwErrorOnValidationFail: boolean = false,
): any => {
  const isValid = inputSchema(data);
  if (!isValid) {
    if (throwErrorOnValidationFail) {
      throw new ValidationError(inputSchema.errors || []);
    }

    return data;
  }

  return data;
};
