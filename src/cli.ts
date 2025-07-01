import { findSimilarCommands } from "src/commands/arg_parser";
import type { Command } from "src/commands/base_command";
import { nativeArgs } from "src/runtime/native_args";
import { nativeExit } from "src/runtime/native_exit";
import { CommandRegistry, commandRegistry } from "./commands/command_registry";

/**
 * CLI entry point
 */
export const cli = async () => {
  await commandRegistry.loadCommands(CommandRegistry.commandsPattern);
  const commandName = nativeArgs.getCliArgs()[0];

  if (!commandName) {
    console.error(
      `No command provided, available commands: ${commandRegistry
        .getCommands()
        .map((command) => command.commandName)
        .join(", ")}`,
    );
    nativeExit.exit(1);
    return;
  }

  const CommandClass = commandRegistry.getCommand(commandName);
  if (!CommandClass) {
    console.error(
      findSimilarCommands(
        commandName,
        commandRegistry.getCommands().map((command) => command.commandName),
      ) || `Command ${commandName} not found`,
    );

    nativeExit.exit(1);
    return;
  }

  const commandClass = CommandClass as unknown as typeof Command;
  // Check if the command has the help flag
  commandClass.handleHelpFlag(commandClass.flags);

  // Validate the command context
  commandClass.validateContext(commandClass);

  // Handle the command
  await commandClass.handle();

  // Exit the process if the command is not keepAlive
  const keepAlive =
    (CommandClass as unknown as typeof Command).options?.keepAlive ?? false;
  if (!keepAlive) {
    nativeExit.exit(0);
  }
};

// Node needs to be handled differently because it does not natively support typescript
if (typeof process !== "undefined") {
  // Allows to import typescript esm files in node.js on the fly
  import("node:module")
    .then(({ register }) => {
      register("ts-node/esm", import.meta.url);
      cli().catch((err) => {
        CommandRegistry.logger.error(err);
        process.exit(1);
      });
    })
    .catch(() => {
      CommandRegistry.logger.error(
        `Failed to register ts-node/esm, you need to install it in your project in order to use typescript in the cli\ntry running: npm install -D ts-node`,
      );
      process.exit(1);
    });
} else {
  cli().catch((err) => {
    CommandRegistry.logger.error(err);
    nativeExit.exit(1);
  });
}
