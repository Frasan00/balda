import { glob } from "glob";
import GenerateCommand from "src/commands/base_commands/generate_command";
import GeneratePluginCommand from "src/commands/base_commands/generate_plugin";
import { logger } from "src/logger/logger";
import { nativeCwd } from "src/runtime/native_cwd";
import type { Command } from "./base_command";
import GenerateCronCommand from "./base_commands/generate_cron";
import InitCommand from "./base_commands/init_command";
import ListCommand from "./base_commands/list_command";

/**
 * Singleton that registers all commands and provides a way to execute them.
 * Commands are loaded from the commands directory, and are expected to have a default export with the command class that extends the base command class.
 * Commands can be run both as `.js` or `.ts` files. If the file is a ts file `typescript` npm package must be installed.
 * You can use the `CommandRegistry.setCommandsPattern` method to change the pattern of the commands to load.
 * @example
 * // commands/test.ts
 * export default class TestCommand extends Command {
 *   static name = "test";
 *   async handle() {
 *     console.log("Test command");
 *   }
 * }
 */
export class CommandRegistry {
  private commands: Map<string, typeof Command>;
  static commandsPattern = "commands/**/*.{ts,js}";
  static logger = logger;

  /**
   * Private constructor to prevent direct instantiation
   * @internal Not meant to be used outside by the user
   */
  private constructor() {
    this.commands = new Map();
  }

  static getInstance() {
    return new CommandRegistry();
  }

  static setCommandsPattern(pattern: string) {
    this.commandsPattern = pattern;
  }

  getCommand(name: string): typeof Command | null {
    return this.commands.get(name) ?? null;
  }

  getCommands(): (typeof Command)[] {
    return Array.from(this.commands.values());
  }

  async loadCommands(commandsPattern: string) {
    CommandRegistry.logger.info(`Loading commands from ${commandsPattern}`);

    const commandFiles = await glob(commandsPattern, {
      absolute: false,
      cwd: nativeCwd.getCwd(),
    });

    for (const commandFile of commandFiles) {
      const command = await import(commandFile)
        .then((module) => {
          if (module.default) {
            return module.default;
          }

          return module;
        })
        .catch((error) => {
          CommandRegistry.logger.error(
            `Error loading command ${commandFile}: ${error}`,
          );
          return null;
        });

      if (command) {
        this.commands.set(command.commandName, command);
      }
    }

    const baseCommands = [
      GeneratePluginCommand,
      GenerateCommand,
      GenerateCronCommand,
      InitCommand,
      ListCommand,
    ];

    for (const command of baseCommands) {
      this.commands.set(command.commandName, command);
    }
  }
}

export const commandRegistry = CommandRegistry.getInstance();
