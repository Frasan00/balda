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
    const commands = commandRegistry.getCommands();

    console.log("\n✨ Available Balda Commands:\n");

    const maxNameLength = Math.max(
      ...commands.map((cmd) => cmd.commandName.length),
    );

    for (const command of commands) {
      const name = command.commandName.padEnd(maxNameLength + 2);
      const desc = command.description || "No description available";
      console.log(`  \x1b[36m${name}\x1b[0m ${desc}`);
    }

    console.log(
      "\n\x1b[90mRun 'npx balda <command> -h' for more information on a specific command.\x1b[0m\n",
    );
  }
}
