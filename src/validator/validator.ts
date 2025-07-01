import { type Static, type TSchema } from "@sinclair/typebox";
import Ajv, { ValidationError } from "ajv";
import addFormats from "ajv-formats";

const ajv = addFormats(new Ajv(), [
  "date-time",
  "time",
  "date",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "uri",
  "uri-reference",
  "uuid",
  "uri-template",
  "json-pointer",
  "relative-json-pointer",
  "regex",
  "password",
  "binary",
  "byte",
  "iso-date-time",
  "iso-time",
]);

export const validateSchema = <T extends TSchema>(
  inputSchema: T,
  data: Record<string, unknown> | string,
  safe: boolean = false,
): Static<T> => {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (error) {
      // TODO: balda error
      throw new Error(`Invalid JSON in serialize "${data}" with type "${typeof data}"`);
    }
  }

  const validate = ajv.compile(inputSchema);
  if (!validate(data)) {
    if (safe) {
      return data;
    }

    throw new ValidationError(validate.errors || []);
  }

  return data;
};
