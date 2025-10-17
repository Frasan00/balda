import { BaldaError } from "src/errors/balda_error";

export class ClientNotFoundError extends BaldaError {
  constructor(...libraries: string[]) {
    super(
      `Library not installed: ${libraries.join(", ")}, try run npm install ${libraries.join(" ")}`,
    );
  }
}
