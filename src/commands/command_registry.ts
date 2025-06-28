import { createLogger } from "../logger/logger";
import { glob } from "glob";
import type { Command } from "./base_command";

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
  private commands: Map<string, new () => Command>;
  static commandsPattern = "commands/**/*.{ts,js}";
  static logger = createLogger({ level: "debug" });

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

  getCommand(name: string): (new () => Command) | null {
    return this.commands.get(name) ?? null;
  }

  getCommands(): (new () => Command)[] {
    return Array.from(this.commands.values());
  }

  async loadCommands(commandsPattern: string) {
    CommandRegistry.logger.info(`Loading commands from ${commandsPattern}`);
    const commandFiles = await glob(commandsPattern);

    if (!commandFiles.length) {
      CommandRegistry.logger.error(`No commands found in ${commandsPattern}`);
      return;
    }

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
          `Error loading command ${commandFile}: ${error}`
        );
        return null;
      });

      if (command) {
        this.commands.set(command.name, command);
      }
    }
  }
}

export const commandRegistry = CommandRegistry.getInstance();
