import {
  getCalledCommandName,
  parseCliArgsAndFlags,
} from "../../commands/arg_parser.js";
import type { Command } from "../../commands/base_command.js";
import { MetadataStore } from "../../metadata_store.js";
import { VALIDATION_ERROR_SYMBOL } from "./arg.js";
import type {
  FlagOptions,
  FlagType,
  InferFlagType,
} from "./command_decorator_types.js";

/**
 * Decorator for defining command-line flags with type safety.
 *
 * Supports multiple flag types:
 * - `boolean`: true/false flags
 * - `string`: text values
 * - `number`: numeric values
 * - `list`: array of strings (can be specified multiple times)
 *
 * @example
 * ```typescript
 * class MyCommand extends Command {
 *   @flag.string({ name: "name", description: "User name" })
 *   name?: string;
 *
 *   @flag.list({ name: "tag", aliases: ["t"], description: "Tags" })
 *   tags!: string[];
 * }
 * ```
 *
 * Usage:
 * - Single flag: `--name=value` or `--name value`
 * - List flag: `--tag=one --tag=two --tag=three`
 * - Aliases: `-t one -t two`
 */
const flagDecorator = <T extends FlagType>(options: FlagOptions<T>) => {
  return (target: any, propertyKey: string) => {
    const currentCommandName = getCalledCommandName();
    // If the called command is not the same as the command class, skip the decorator
    if (
      !currentCommandName ||
      currentCommandName !== (target as typeof Command).commandName
    ) {
      return;
    }

    const primaryFlagName = options.name || propertyKey;
    const parsedFlags = parseCliArgsAndFlags().flags;
    const flagAliases = options.aliases
      ? Array.isArray(options.aliases)
        ? options.aliases
        : [options.aliases]
      : [];
    const allFlagVariants = [primaryFlagName, ...flagAliases];

    // Find the actual flag value by checking all possible flag names
    let resolvedFlagValue = options.defaultValue;

    for (const flagVariant of allFlagVariants) {
      // Check both with and without prefixes
      const possibleNames = [
        flagVariant,
        `-${flagVariant}`,
        `--${flagVariant}`,
      ];

      for (const flagName of possibleNames) {
        if (flagName in parsedFlags) {
          const rawValue = parsedFlags[flagName];

          if (options.type === "list") {
            // For list type, ensure we have an array
            const arrayValue = Array.isArray(rawValue) ? rawValue : [rawValue];
            resolvedFlagValue = arrayValue.map((val) => {
              const stringVal = String(val);
              return options.parse ? options.parse(stringVal) : stringVal;
            }) as InferFlagType<T>;
          } else {
            resolvedFlagValue = rawValue as InferFlagType<T>;

            if (options.type === "boolean") {
              resolvedFlagValue = Boolean(
                resolvedFlagValue,
              ) as InferFlagType<T>;
            } else if (options.type === "number") {
              resolvedFlagValue = Number(resolvedFlagValue) as InferFlagType<T>;
            } else if (options.type === "string") {
              resolvedFlagValue = String(resolvedFlagValue) as InferFlagType<T>;
            }

            if (options.parse) {
              resolvedFlagValue = options.parse(resolvedFlagValue);
            }
          }

          break;
        }
      }

      if (resolvedFlagValue !== options.defaultValue) {
        break;
      }
    }

    MetadataStore.set(target, propertyKey, {
      type: "flag",
      name: primaryFlagName,
      aliases: flagAliases || [],
      description: options.description,
    });

    if (options.required) {
      const isValueMissing =
        options.type === "list"
          ? !resolvedFlagValue ||
            (Array.isArray(resolvedFlagValue) && resolvedFlagValue.length === 0)
          : !resolvedFlagValue;

      if (isValueMissing) {
        const errorChain = MetadataStore.get(target, VALIDATION_ERROR_SYMBOL);
        MetadataStore.set(target, VALIDATION_ERROR_SYMBOL, [
          ...(errorChain || []),
          {
            type: "flag",
            name: primaryFlagName,
            message: "Required flag not provided",
          },
        ]);
        return;
      }
    }

    Object.defineProperty(target, propertyKey, {
      value: resolvedFlagValue,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
};

/** Shorthand decorator for boolean flags */
flagDecorator.boolean = (options: Omit<FlagOptions<"boolean">, "type">) => {
  return flagDecorator({ ...options, type: "boolean" });
};

/** Shorthand decorator for string flags */
flagDecorator.string = (options: Omit<FlagOptions<"string">, "type">) => {
  return flagDecorator({ ...options, type: "string" });
};

/** Shorthand decorator for number flags */
flagDecorator.number = (options: Omit<FlagOptions<"number">, "type">) => {
  return flagDecorator({ ...options, type: "number" });
};

/** @alias for array */
flagDecorator.list = (options: Omit<FlagOptions<"list">, "type">) => {
  return flagDecorator({ ...options, type: "list" });
};

/** Shorthand decorator for array flags (can be specified multiple times) */
flagDecorator.array = (options: Omit<FlagOptions<"list">, "type">) => {
  return flagDecorator({ ...options, type: "list" });
};

export const flag = flagDecorator;
