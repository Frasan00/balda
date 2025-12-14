export type FlagType = "boolean" | "string" | "number" | "list";

export type InferFlagType<T extends FlagType> = T extends "boolean"
  ? boolean
  : T extends "string"
    ? string
    : T extends "number"
      ? number
      : T extends "list"
        ? string[]
        : never;

export type ArgOptions = {
  /**
   * The description of the argument.
   */
  description?: string;
  /**
   * Whether the argument is required.
   * @default false
   */
  required?: boolean;
  /**
   * The default value of the argument.
   */
  defaultValue?: string;
  /**
   * A function to parse the argument value.
   * @default The value is returned as is.
   */
  parse?: (value: string) => string;
};

export type FlagOptions<T extends FlagType> = {
  /**
   * The description of the flag.
   */
  description?: string;
  /**
   * The type of the flag.
   */
  type: T;
  /**
   * The name of the flag.
   * @default The name of the field.
   */
  name?: string;
  /**
   * The aliases of the flag.
   */
  aliases?: string[] | string;
  /**
   * The default value of the flag.
   */
  defaultValue?: InferFlagType<T>;

  /**
   * Whether the flag is required.
   * @default false
   */
  required?: boolean;
  /**
   * A function to parse the flag value.
   * @default The value is returned as is.
   */
  parse?: (value: any) => InferFlagType<T>;
};
