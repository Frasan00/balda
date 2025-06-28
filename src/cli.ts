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
        .map((command) => command.name)
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
        commandRegistry.getCommands().map((command) => command.name),
      ) || `Command ${commandName} not found`,
    );

    nativeExit.exit(1);
    return;
  }

  const command = new CommandClass();
  const commandClass = CommandClass as unknown as typeof Command;
  commandClass.handleHelpFlag(commandClass.flags);
  await commandClass.handle();
  if (!(CommandClass as unknown as typeof Command).options?.keepAlive) {
    nativeExit.exit(0);
  }
};

cli().catch((err) => {
  CommandRegistry.logger.error(err);
  nativeExit.exit(1);
});
