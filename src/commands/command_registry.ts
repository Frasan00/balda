import type { Logger } from "pino";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { nativePath } from "../runtime/native_path.js";
import { Command } from "./base_command.js";
import BuildCommand from "./base_commands/build_command.js";
import CronStartCommand from "./base_commands/cron_start_command.js";
import GenerateCommand from "./base_commands/generate_command.js";
import GenerateControllerCommand from "./base_commands/generate_controller.js";
import GenerateCronCommand from "./base_commands/generate_cron.js";
import GenerateMiddlewareCommand from "./base_commands/generate_middleware.js";
import GenerateMqttCommand from "./base_commands/generate_mqtt.js";
import GeneratePluginCommand from "./base_commands/generate_plugin.js";
import GenerateQueueCommand from "./base_commands/generate_queue.js";
import GenerateSdkCommand from "./base_commands/generate_sdk.js";
import InitCommand from "./base_commands/init_command.js";
import InitMailerCommand from "./base_commands/init_mailer_command.js";
import InitQueueCommand from "./base_commands/init_queue_command.js";
import KeyGenerateCommand from "./base_commands/key_generate_command.js";
import ListCommand from "./base_commands/list_command.js";
import QueueWorkCommand from "./base_commands/queue_work_command.js";
import ServeCommand from "./base_commands/serve_command.js";
import SetupStorageCommand from "./base_commands/setup_storage_command.js";
import { nativeFs } from "../runtime/native_fs.js";

// Base commands are always loaded
export const baseCommands = [
  GeneratePluginCommand,
  GenerateCommand,
  GenerateCronCommand,
  GenerateMqttCommand,
  GenerateQueueCommand,
  GenerateControllerCommand,
  GenerateMiddlewareCommand,
  GenerateSdkCommand,
  InitCommand,
  InitMailerCommand,
  InitQueueCommand,
  ListCommand,
  BuildCommand,
  ServeCommand,
  SetupStorageCommand,
  KeyGenerateCommand,
  QueueWorkCommand,
  CronStartCommand,
];

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
  private builtInCommands: Set<string>;
  static commandsPattern = "src/commands/**/*.{ts,js}";
  static loggerPath = "src/logger.ts";
  static logger = logger.child({ scope: "CommandRegistry" });

  /**
   * Override the default logger used by CommandRegistry and all Command subclasses.
   * @param customLogger - A pino Logger instance
   */
  static setLogger(customLogger: Logger) {
    CommandRegistry.logger = customLogger.child({ scope: "CommandRegistry" });
    Command.logger = customLogger.child({ scope: "Command" });
  }

  /**
   * Dynamically imports the logger file and sets it as the logger for all commands.
   * The file must export a named `logger` that is a pino Logger instance.
   * @param overridePath - Optional path override (e.g. from CommandOptions.loggerPath). Falls back to CommandRegistry.loggerPath.
   */
  static async loadLogger(overridePath?: string): Promise<void> {
    const loggerPath = overridePath || CommandRegistry.loggerPath;
    try {
      const mod = await import(nativePath.join(nativeCwd.getCwd(), loggerPath));
      if (mod.logger) {
        CommandRegistry.setLogger(mod.logger);
      }
    } catch {
      CommandRegistry.logger.debug(
        `Could not load logger from ${loggerPath}, using default logger`,
      );
    }
  }

  /**
   * Private constructor to prevent direct instantiation
   * @internal Not meant to be used outside by the user
   */
  private constructor() {
    this.commands = new Map();
    this.builtInCommands = new Set();
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

  getBuiltInCommands(): (typeof Command)[] {
    return Array.from(this.commands.values()).filter((cmd) =>
      this.builtInCommands.has(cmd.commandName),
    );
  }

  getUserDefinedCommands(): (typeof Command)[] {
    return Array.from(this.commands.values()).filter(
      (cmd) => !this.builtInCommands.has(cmd.commandName),
    );
  }

  isBuiltInCommand(commandName: string): boolean {
    return this.builtInCommands.has(commandName);
  }

  async loadCommands(commandsPattern: string) {
    CommandRegistry.logger.info(`Loading commands from ${commandsPattern}`);

    const commandFiles = await nativeFs.glob(commandsPattern, {
      cwd: nativeCwd.getCwd(),
    });

    // if even one file is ts check if ts-node is installed
    if (commandFiles.some((file) => file.endsWith(".ts"))) {
      try {
        const { register } = await import("node:module");
        register("ts-node/esm", import.meta.url);
      } catch {
        CommandRegistry.logger.error(
          `Failed to register ts-node/esm, you need to install it in your project in order to use typescript in the cli\ntry running: \`npm install -D ts-node\``,
        );
        process.exit(1);
      }
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
            `Error loading command ${commandFile}: ${error}`,
          );
          return null;
        });

      if (command) {
        this.commands.set(command.commandName, command);
      }
    }

    for (const command of baseCommands) {
      this.commands.set(command.commandName, command);
      this.builtInCommands.add(command.commandName);
    }
  }
}

export const commandRegistry = CommandRegistry.getInstance();
