import type { Argument, FlagSchema } from "./arg_parser.js";
import type { Command } from "./base_command.js";

export type CommandOptions = {
  /**
   * If true, the command won't be killed after it's finished. Defaults to false.
   */
  keepAlive?: boolean;

  /**
   * Category for grouping commands in help output
   * @example 'generator', 'development', 'production', 'database'
   */
  category?: string;

  /**
   * Mark command as deprecated with optional replacement
   * @example { message: 'Use generate-controller instead', replacement: 'generate-controller' }
   */
  deprecated?: {
    message?: string;
    replacement?: string;
  };

  /**
   * Custom validation function that runs before handle()
   */
  validate?: (command: typeof Command) => boolean | Promise<boolean>;

  /**
   * Path to a file that exports a pino `logger` instance, loaded before command execution.
   * Overrides `CommandRegistry.loggerPath` for this command only.
   * The file must have a named export `logger` (a pino Logger instance).
   * @default "src/logger.ts"
   */
  loggerPath?: string;

  /**
   * If true, unknown flags (not declared via @flag decorators) are allowed.
   * If false, the command will throw an error when unknown flags are provided.
   * `-h` and `--help` are always allowed regardless of this setting.
   * @default true
   */
  allowUnknownFlags?: boolean;
};

export type CommandFlagsAndArgs = {
  flags: FlagSchema;
  args: Argument[];
};
