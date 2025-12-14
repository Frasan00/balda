import type { Command } from "./base_command";

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
};
