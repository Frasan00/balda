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

export const flag = <T extends FlagType>(options: FlagOptions<T>) => {
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
