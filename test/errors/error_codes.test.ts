import { describe, expect, it } from "vitest";
import { BaldaError } from "../../src/errors/balda_error.js";
import { ClientNotFoundError } from "../../src/errors/client_not_found_error.js";
import { FileNotFoundError } from "../../src/errors/file_not_found_error.js";
import { FileTooLargeError } from "../../src/errors/file_too_large.js";
import { JsonNotValidError } from "../../src/errors/json_not_valid.js";
import { MethodNotAllowedError } from "../../src/errors/method_not_allowed.js";
import { RouteNotFoundError } from "../../src/errors/route_not_found.js";
import { errorFactory } from "../../src/errors/error_factory.js";

describe("built-in error codes", () => {
  it("reports each subclass name, not the Error default", () => {
    const cases: [BaldaError, string][] = [
      [new RouteNotFoundError("/users", "GET"), "RouteNotFoundError"],
      [new MethodNotAllowedError("/users", "DELETE"), "MethodNotAllowedError"],
      [new JsonNotValidError("Bad"), "JsonNotValidError"],
      [new FileTooLargeError("a.png", 10, 5), "FileTooLargeError"],
      [new FileNotFoundError("a.png"), "FileNotFoundError"],
      [new ClientNotFoundError("zod"), "ClientNotFoundError"],
    ];

    for (const [error, name] of cases) {
      expect(error.name).toBe(name);
      expect(errorFactory(error).code).toBe(name);
    }
  });

  // The published bundles are minified, so a name read at runtime has to survive
  // mangling; tsup's keepNames is what holds this up.
  it("keeps names on subclass instances created through a subclass constructor", () => {
    class CustomError extends BaldaError {}

    expect(new CustomError("boom").name).toBe("CustomError");
  });
});
