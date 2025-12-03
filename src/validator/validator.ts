import { type ZodType } from "zod";

/**
 * Validates data against a Zod schema synchronously.
 *
 * @warning Only synchronous Zod schemas are supported. Async refinements (e.g. `.refine(async () => ...)`)
 * or async transforms will throw an error. Use standard Zod methods like `.parse()` or `.safeParse()`
 * directly if you need async validation.
 *
 * @param inputSchema - The Zod schema to validate against
 * @param data - The data to validate
 * @param safe - If true, returns undefined instead of throwing on validation failure
 * @returns The validated data
 * @throws ZodError if validation fails and safe is false
 */
export const validateSchema = <T extends ZodType>(
  inputSchema: T,
  data: any,
  safe: boolean = false,
): any => {
  const {
    success,
    data: validatedData,
    error: zodError,
  } = inputSchema.safeParse(data);

  if (!success) {
    if (safe) {
      return validatedData;
    }

    throw zodError;
  }

  return validatedData;
};
