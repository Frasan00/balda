import { getCalledCommandName, parseCliArgsAndFlags } from "src/commands/arg_parser";
import type { Command } from "src/commands/base_command";
import type {
  FlagOptions,
  FlagType,
} from "src/decorators/command/command_decorator_types";

const stripFlagPrefixes = (flagName: string) => {
  if (!flagName) {
    return "";
  }

  return flagName.replace(/^--/, "").replace(/^-/, "");
};

export const flag = <T extends FlagType>(options: FlagOptions<T>) => {
  return (target: any, propertyKey: string) => {
    const currentCommandName = getCalledCommandName();
    // If the called command is not the same as the command class, skip the decorator
    if (currentCommandName && currentCommandName !== (target as typeof Command).name) {
      return;
    }

    const commandClass = target.constructor as typeof Command;
    const primaryFlagName = options.name || propertyKey;
    const parsedFlags = parseCliArgsAndFlags().flags;
    const availableFlagNames = Object.keys(parsedFlags).map(stripFlagPrefixes);
    const flagAliases = options.aliases || [];
    const allFlagVariants = [primaryFlagName, ...flagAliases];
    const normalizedFlagVariants = allFlagVariants.map(stripFlagPrefixes);
    const resolvedFlagValue = normalizedFlagVariants.find((flag) => availableFlagNames.includes(flag)) || options.defaultValue;

    if (options.required && !resolvedFlagValue) {
      throw new Error(
        `Flag "${primaryFlagName}" is required for command "${(target as typeof Command).name}"`
      );
    }

    Object.defineProperty(target, propertyKey, {
      value: resolvedFlagValue,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
};
