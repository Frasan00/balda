import { Command } from "src/commands/base_command";
import { commandRegistry } from "src/commands/command_registry";

export default class ListCommand extends Command {
  static commandName = "list";
  static description = "List all available commands";
  static help = [
    "Display all registered Balda CLI commands with their descriptions",
    "Example: npx balda list",
  ];

  static async handle(): Promise<void> {
    const builtInCommands = commandRegistry.getBuiltInCommands();
    const userCommands = commandRegistry.getUserDefinedCommands();

    console.log("\n✨ Available Balda Commands:\n");

    // Group user commands by category
    if (userCommands.length > 0) {
      console.log("\x1b[1;33mUser Commands:\x1b[0m\n");

      const categorizedCommands = this.groupByCategory(userCommands);
      this.displayCategorizedCommands(categorizedCommands);
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

        // Deprecated warning
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
  }

  private static groupByCategory(
    commands: (typeof Command)[],
  ): Map<string, (typeof Command)[]> {
    const map = new Map<string, (typeof Command)[]>();

    for (const command of commands) {
      const category = command.options?.category || "other";
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(command);
    }

    return map;
  }

  private static displayCategorizedCommands(
    categorizedCommands: Map<string, (typeof Command)[]>,
  ): void {
    const sortedCategories = Array.from(categorizedCommands.keys()).sort();

    for (const category of sortedCategories) {
      const commands = categorizedCommands
        .get(category)!
        .filter((cmd) => cmd && cmd.commandName);

      if (commands.length === 0) {
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

        // Deprecated warning
        let deprecatedTag = "";
        if (command.options?.deprecated) {
          deprecatedTag = " \x1b[33m[deprecated]\x1b[0m";
        }

        console.log(`    \x1b[36m${name}\x1b[0m ${desc}${deprecatedTag}`);
      }

      console.log("");
    }
  }
}
