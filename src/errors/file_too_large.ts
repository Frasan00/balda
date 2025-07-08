import { BaldaError } from "src/errors/balda_error";

export class FileTooLargeError extends BaldaError {
  constructor(filename: string, size: number, maxSize: number) {
    super(
      `FILE_TOO_LARGE: "${filename}" is too large. Max size is ${maxSize} bytes, but got ${size} bytes`,
    );
  }
}
