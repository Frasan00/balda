import { Command } from "src/commands/base_command";
import { commandRegistry } from "src/commands/command_registry";
import { arg } from "src/decorators/command/arg";
import { nativeFs } from "src/runtime/native_fs";
import { nativePath } from "src/runtime/native_path";

export default class GenerateCommand extends Command {
  static commandName = "generate-command";
  static description = "Generate a new command in the specified path";
  static help = [
    "Generate a new cli command in the specified path",
    "Example: npx balda generate-command my-command -p src/commands",
  ];

  /**
   * The path where the command will be generated
   */
  static path = "src/commands";

  @arg({
    description: "The name of the command to generate",
    required: true,
  })
  static name: string;

  static async handle(): Promise<void> {
    // Check if command already exists to prevent overriding built-in commands
    const existingCommand = commandRegistry.getCommand(this.name);
    if (existingCommand) {
      const isBuiltIn = commandRegistry.isBuiltInCommand(this.name);
      const commandType = isBuiltIn ? "built-in" : "user-defined";
      this.logger.error(
        { commandName: this.name, type: commandType },
        `Command "${this.name}" already exists as a ${commandType} command. Cannot override existing commands.`,
      );
      return;
    }

    const commandTemplate = this.getCommandTemplate();
    this.path = nativePath.join(this.path, `${this.name}.ts`);

    if (!(await nativeFs.exists(nativePath.join(process.cwd(), this.path)))) {
      await nativeFs.mkdir(
        nativePath.join(
          process.cwd(),
          this.path.split("/").slice(0, -1).join("/"),
        ),
        { recursive: true },
      );
    }

    await nativeFs.writeFile(
      this.path,
      new TextEncoder().encode(commandTemplate),
    );

    this.logger.info(
      `Command ${this.name} created successfully at ${this.path}`,
    );
  }

  static getCommandTemplate() {
    return `import { Command, CommandOptions } from "balda-js";

export default class extends Command {
  static commandName = "${this.name}";
  static description = "Command description";

  static options: CommandOptions = {
    // Define your command options here
    keepAlive: false,
  };

  static async handle(): Promise<void> {
    // Implement your command logic here
  }
}`;
  }
}
