import { BaldaError } from "./balda_error.js";

export class JsonNotValidError extends BaldaError {
  constructor(json: any) {
    super(`JSON_NOT_VALID: "${JSON.stringify(json)}" is not a valid JSON`);
  }
}
