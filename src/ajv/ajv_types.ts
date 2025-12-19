import type { Ajv } from "ajv";

export type AjvInstance = InstanceType<typeof Ajv>;
export type AjvCompileParams = Parameters<AjvInstance["compile"]>;
export type AjvCompileReturnType = ReturnType<AjvInstance["compile"]>;
