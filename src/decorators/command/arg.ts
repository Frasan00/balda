import type { Command } from "src/commands/base_command";
import type { ArgOptions } from "./command_decorator_types";
import {
  getCalledCommandName,
  parseCliArgsAndFlags,
} from "src/commands/arg_parser";

/**
 * The arguments of the current command. Shifted to get the next argument each time for each argument decorator.
 */
let args = parseCliArgsAndFlags().args.slice(1);

/**
 * Decorator to mark a field of a command class as an argument.
 * @param options - The options for the argument.
 * @warning Arguments are evaluated in the order they are defined in the Command class.
 */
export const arg = (options: ArgOptions) => {
  return (target: any, propertyKey: string) => {
    const currentCommandName = getCalledCommandName();
    // If the called command is not the same as the command class, skip the decorator
    if (
      currentCommandName &&
      currentCommandName !== (target as typeof Command).name
    ) {
      return;
    }

    const argName = propertyKey;
    let argValue = args.length ? args.shift() : options.defaultValue;
    if (options.required && !argValue) {
      // TODO: balda error
      throw new Error(
        `Argument ${argName} is required for command "${(target as typeof Command).name}"`,
      );
    }

    if (options.parse && argValue) {
      argValue = options.parse(argValue);
    }

    Object.defineProperty(target, propertyKey, {
      value: argValue,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
};
