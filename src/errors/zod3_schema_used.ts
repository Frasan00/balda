import { BaldaError } from "./balda_error.js";

export class Zod3SchemaUsedError extends BaldaError {
  constructor(error: Error) {
    super(
      "Failed to convert Zod schema to JSON Schema. " +
        "This usually happens when using Zod v3 schemas with Zod v4. " +
        "Make sure you're importing from 'zod' (v4) and not 'zod/v3'. " +
        `Original error: ${error.message}`,
    );
  }
}
