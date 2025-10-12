import {
  getCalledCommandName,
  parseCliArgsAndFlags,
} from "src/commands/arg_parser";
import type { Command } from "src/commands/base_command";
import { VALIDATION_ERROR_SYMBOL } from "src/decorators/command/arg";
import type {
  FlagOptions,
  FlagType,
  InferFlagType,
} from "src/decorators/command/command_decorator_types";
import { MetadataStore } from "src/metadata_store";

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
    const flagAliases = options.aliases || [];
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
          resolvedFlagValue = parsedFlags[flagName] as InferFlagType<T>;

          if (options.type === "boolean") {
            resolvedFlagValue = Boolean(resolvedFlagValue) as InferFlagType<T>;
          } else if (options.type === "number") {
            resolvedFlagValue = Number(resolvedFlagValue) as InferFlagType<T>;
          }

          if (options.parse) {
            resolvedFlagValue = options.parse(resolvedFlagValue);
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

    if (options.required && !resolvedFlagValue) {
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

export const flag = flagDecorator;
