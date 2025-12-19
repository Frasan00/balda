import { ValidationError } from "ajv";
import { AjvCompileReturnType } from "../ajv/ajv_types.js";

/**
 * Validates data against an AJV schema synchronously.
 *
 * @param inputSchema - The compiled AJV validator function
 * @param data - The data to validate
 * @param safe - If true, returns undefined instead of throwing on validation failure
 * @returns The validated data
 * @throws Error if validation fails and safe is false
 */
export const validateSchema = (
  inputSchema: AjvCompileReturnType,
  data: any,
  safe: boolean = false,
): any => {
  const isValid = inputSchema(data);
  if (!isValid) {
    if (safe) {
      return data;
    }

    throw new ValidationError(inputSchema.errors || []);
  }

  return data;
};
