import { Static, type TSchema } from "@sinclair/typebox";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = addFormats(new Ajv({}), [
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
]);

export const validateSchema = <T extends TSchema>(
  inputSchema: T,
  data: Record<string, unknown>,
  safe: boolean = false
): Static<T> => {
  const compiledSchema = ajv.compile(inputSchema);
  const result = compiledSchema(data);
  if (!result) {
    if (safe) {
      return data;
    }

    throw new Error(ajv.errorsText());
  }

  return data as Static<T>;
};
