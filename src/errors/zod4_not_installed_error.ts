import { BaldaError } from "./balda_error.js";

export class Zod4NotInstalledError extends BaldaError {
  constructor() {
    super(
      "Zod v4 is required with the toJSONSchema() method. Install it with: npm install zod@^4.0.0",
    );
  }
}
