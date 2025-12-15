import { BaldaError } from "./balda_error.js";

export class ClientNotFoundError extends BaldaError {
  constructor(...libraries: string[]) {
    super(
      `Library not installed: ${libraries.join(", ")}, try run npm install ${libraries.join(" ")}`,
    );
  }
}
