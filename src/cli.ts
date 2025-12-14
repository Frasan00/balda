import { findSimilarCommands } from "src/commands/arg_parser";
import type { Command } from "src/commands/base_command";
import { nativeArgs } from "src/runtime/native_args";
import { nativeExit } from "src/runtime/native_exit";
import { CommandRegistry, commandRegistry } from "./commands/command_registry";

// Helper functions for grouping and displaying commands
const groupByCategory = (
  commands: (typeof Command)[],
): Map<string, (typeof Command)[]> => {
  const map = new Map<string, (typeof Command)[]>();

  for (const command of commands) {
    const category = command.options?.category || "other";
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category)!.push(command);
  }

  return map;
};

const displayCategorizedCommands = (
  categorizedCommands: Map<string, (typeof Command)[]>,
): void => {
  const sortedCategories = Array.from(categorizedCommands.keys()).sort();

  for (const category of sortedCategories) {
    const commands = categorizedCommands
      .get(category)!
      .filter((cmd) => cmd && cmd.commandName);

    if (!commands.length) {
      continue;
    }

    // Display category header with color
    const categoryColors: Record<string, string> = {
      generator: "\x1b[35m", // Magenta
      setup: "\x1b[34m", // Blue
      production: "\x1b[32m", // Green
      utility: "\x1b[36m", // Cyan
      other: "\x1b[37m", // White
    };

    const color = categoryColors[category] || "\x1b[37m";
    console.log(`  ${color}${category.toUpperCase()}:\x1b[0m`);

    const maxNameLength = Math.max(
      ...commands.map((cmd) => cmd.commandName.length),
    );

    for (const command of commands) {
      const name = command.commandName.padEnd(maxNameLength + 2);
      const desc = command.description || "No description available";

      // Show deprecated warning if applicable
      let deprecatedTag = "";
      if (command.options?.deprecated) {
        deprecatedTag = " \x1b[33m[deprecated]\x1b[0m";
      }

      console.log(`    \x1b[36m${name}\x1b[0m ${desc}${deprecatedTag}`);
    }

    console.log("");
  }
};

/**
 * CLI entry point
 */
export const cli = async () => {
  await commandRegistry.loadCommands(CommandRegistry.commandsPattern);
  const commandName = nativeArgs.getCliArgs()[0];

  // Handle global help flag
  if (commandName === "-h" || commandName === "--help") {
    const builtInCommands = commandRegistry.getBuiltInCommands();
    const userCommands = commandRegistry.getUserDefinedCommands();

    console.log("\n✨ Available Balda Commands:\n");

    // Display user commands grouped by category
    if (userCommands.length > 0) {
      console.log("\x1b[1;33mUser Commands:\x1b[0m\n");
      displayCategorizedCommands(groupByCategory(userCommands));
    }

    // Display built-in commands without categories
    if (builtInCommands.length > 0) {
      console.log("\x1b[1;32mBuilt-in Commands:\x1b[0m\n");

      const maxNameLength = Math.max(
        ...builtInCommands.map((cmd) => cmd.commandName.length),
      );

      for (const command of builtInCommands) {
        const name = command.commandName.padEnd(maxNameLength + 2);
        const desc = command.description || "No description available";

        // Show deprecated warning if applicable
        let deprecatedTag = "";
        if (command.options?.deprecated) {
          deprecatedTag = " \x1b[33m[deprecated]\x1b[0m";
        }

        console.log(`  \x1b[36m${name}\x1b[0m ${desc}${deprecatedTag}`);
      }

      console.log("");
    }

    console.log(
      "\x1b[90mRun 'npx balda <command> -h' for more information on a specific command.\x1b[0m\n",
    );

    nativeExit.exit(0);
    return;
  }

  if (!commandName) {
    console.error(
      `No command provided, available commands: ${commandRegistry
        .getCommands()
        .filter((command) => command && command.commandName)
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
        commandRegistry
          .getCommands()
          .filter((command) => command && command.commandName)
          .map((command) => command.commandName),
      ) || `Command ${commandName} not found`,
    );

    nativeExit.exit(1);
    return;
  }

  const commandClass = CommandClass as unknown as typeof Command;

  // Deprecated command warning
  if (commandClass.options?.deprecated) {
    const message =
      commandClass.options.deprecated.message || "This command is deprecated";
    const replacement = commandClass.options.deprecated.replacement;
    console.warn(`\x1b[33m⚠️  Warning: ${message}\x1b[0m`);
    if (replacement) {
      console.warn(`\x1b[33m   Use '${replacement}' instead.\x1b[0m\n`);
    }
  }

  // Check if the command has the help flag
  commandClass.handleHelpFlag(commandClass.flags);

  // Validate the command context
  commandClass.validateContext(commandClass);

  // Run custom validation if provided
  if (commandClass.options?.validate) {
    const isValid = await commandClass.options.validate(commandClass);
    if (!isValid) {
      console.error("Command validation failed");
      nativeExit.exit(1);
      return;
    }
  }

  // Handle the command
  await commandClass.handle();

  // Exit the process if the command is not keepAlive
  const keepAlive =
    (CommandClass as unknown as typeof Command).options?.keepAlive ?? false;
  if (!keepAlive) {
    nativeExit.exit(0);
  }
};

if (typeof process !== "undefined") {
  // Try to run CLI without ts-node first (for js files)
  cli().catch(async (err) => {
    if (
      err?.message?.includes("SyntaxError") ||
      err?.code === "ERR_UNKNOWN_FILE_EXTENSION"
    ) {
      try {
        const { register } = await import("node:module");
        register("ts-node/esm", import.meta.url);
        cli().catch((retryErr) => {
          CommandRegistry.logger.error(retryErr);
          process.exit(1);
        });
      } catch (registerErr) {
        CommandRegistry.logger.error(
          `Failed to register ts-node/esm, you need to install it in your project in order to use typescript in the cli\ntry running: \`npm install -D ts-node\``,
        );
        process.exit(1);
      }
    } else {
      CommandRegistry.logger.error(err);
      process.exit(1);
    }
  });
} else {
  cli().catch((err) => {
    CommandRegistry.logger.error(err);
    nativeExit.exit(1);
  });
}
