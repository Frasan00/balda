import { BaldaError } from "./balda_error.js";

export class FileNotFoundError extends BaldaError {
  constructor(key: string) {
    super(`File not found: ${key}`);
  }
}
