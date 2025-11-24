import Ajv, { ValidationError } from "ajv";
import addFormats from "ajv-formats";
import { z, type ZodType } from "zod";

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

export const validateSchema = <T extends ZodType>(
  inputSchema: T,
  data: any,
  safe: boolean = false,
): any => {
  const jsonSchema = z.toJSONSchema(inputSchema);
  const { $schema, ...schemaWithoutMeta } = jsonSchema;
  const validate = ajv.compile(schemaWithoutMeta);
  if (!validate(data)) {
    if (safe) {
      return data;
    }

    throw new ValidationError(validate.errors || []);
  }

  return data;
};
