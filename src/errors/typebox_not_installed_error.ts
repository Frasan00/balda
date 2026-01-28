import { BaldaError } from "./balda_error.js";

export class TypeBoxNotInstalledError extends BaldaError {
  constructor() {
    super(
      "TypeBox is not installed. Install it with: npm install @sinclair/typebox",
    );
  }
}
