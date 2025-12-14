import { nativeArgs } from "src/runtime/native_args";
import { levenshteinDistance } from "src/utils";

export type Argument = string;
export type FlagSchema = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

/**
 * Parses a single flag argument
 * Supports formats: -f, --flag, -f=value, --flag=value, -f value, --flag value
 */
const parseFlag = (
  arg: string,
): { name: string; value: string | number | boolean } | null => {
  if (!arg || arg === "-" || arg === "--") {
    return null;
  }

  const equalIndex = arg.indexOf("=");
  if (equalIndex > 0) {
    const name = arg.substring(0, equalIndex);
    const value = arg.substring(equalIndex + 1);
    return {
      name,
      value: parseFlagValue(value),
    };
  }

  return { name: arg, value: true };
};

/**
 * Parses flag value, attempting to convert to appropriate type
 */
const parseFlagValue = (value: string): string | number | boolean => {
  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  const numValue = Number(value);
  if (!Number.isNaN(numValue) && Number.isFinite(numValue)) {
    return numValue;
  }

  return value;
};

/**
 * Parses CLI arguments and flags from command line input
 * Supports various flag formats: -f, --flag, -f=value, --flag=value, -f value, --flag value
 * @returns Object containing parsed arguments and flags
 */
export const parseCliArgsAndFlags = (): {
  args: Argument[];
  flags: FlagSchema;
} => {
  const cliArgs = nativeArgs.getCliArgs();
  const parsedArgs: Argument[] = [];
  const parsedFlags = {} as FlagSchema;

  if (!cliArgs || !cliArgs.length) {
    return { args: parsedArgs, flags: parsedFlags };
  }

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];

    if (!arg || typeof arg !== "string") {
      continue;
    }

    if (arg.startsWith("-")) {
      const flag = parseFlag(arg);
      if (flag) {
        // Check if this is a boolean flag that might have a value in the next argument
        if (flag.value === true && i + 1 < cliArgs.length) {
          const nextArg = cliArgs[i + 1];
          if (
            nextArg &&
            typeof nextArg === "string" &&
            !nextArg.startsWith("-")
          ) {
            flag.value = parseFlagValue(nextArg);
            i++; // Skip the next argument since we consumed it
          }
        }

        // If flag already exists, convert to array and append
        if (flag.name in parsedFlags) {
          const existingValue = parsedFlags[flag.name];
          if (Array.isArray(existingValue)) {
            existingValue.push(flag.value);
          } else {
            parsedFlags[flag.name] = [existingValue, flag.value];
          }
        } else {
          parsedFlags[flag.name] = flag.value;
        }
      }
      continue;
    }

    parsedArgs.push(arg);
  }

  return { args: parsedArgs, flags: parsedFlags };
};

/**
 * Finds similar commands using fuzzy matching
 * @param notFoundCommand - The command that was not found
 * @param availableCommands - Array of available commands to search through
 * @returns Formatted string with suggestions or empty string if no matches
 */
export const findSimilarCommands = (
  notFoundCommand: string,
  availableCommands: string[],
): string => {
  if (!notFoundCommand || typeof notFoundCommand !== "string") {
    return "";
  }

  if (
    !availableCommands ||
    !Array.isArray(availableCommands) ||
    availableCommands.length === 0
  ) {
    return "";
  }

  const searchTerm = notFoundCommand.toLowerCase().trim();

  const similarCommands = availableCommands.filter((command) => {
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand === searchTerm) {
      return true;
    }

    if (
      normalizedCommand.includes(searchTerm) ||
      searchTerm.includes(normalizedCommand)
    ) {
      return true;
    }

    const distance = levenshteinDistance(normalizedCommand, searchTerm);
    const maxDistance =
      Math.max(searchTerm.length, normalizedCommand.length) * 0.4; // 40% threshold

    return distance <= maxDistance;
  });

  if (similarCommands.length === 0) {
    return "";
  }

  const topSuggestions = similarCommands.slice(0, 3);
  const suggestions = topSuggestions
    .map((cmd) => `\x1b[36m${cmd}\x1b[0m`)
    .join(", ");
  return `\x1b[31m✗\x1b[0m Command \x1b[33m${notFoundCommand}\x1b[0m not found\n\x1b[32m💡\x1b[0m Did you mean: ${suggestions}?`;
};

export const getCalledCommandName = (): string | null => {
  const cliArgs = nativeArgs.getCliArgs();
  return cliArgs[0] || null;
};
