import { BaldaError } from "./balda_error.js";

export class FileTooLargeError extends BaldaError {
  constructor(filename: string, size: number, maxSize: number) {
    super(
      `FILE_TOO_LARGE: "${filename}" is too large. Max size is ${maxSize} bytes, but got ${size} bytes`,
    );
  }
}
