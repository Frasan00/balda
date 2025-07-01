import { join } from "node:path";
import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";

export default class GenerateCommand extends Command {
  static commandName = "generate-command";
  static description = "Generate a new command in the specified path";
  static help = [
    "Generate a new cli command in the specified path",
    "Example: npx balda generate-command my-command -p src/commands",
  ];

  @arg({
    description: "The name of the command to generate",
    required: true,
  })
  static name: string;

  @flag({
    description: "The path to the command to generate, default is src/commands",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/commands",
  })
  static path: string;

  static async handle(): Promise<void> {
    const commandTemplate = this.getCommandTemplate();
    this.path = join(this.path, `${this.name}.ts`);
    await nativeFs.writeFile(
      this.path,
      new TextEncoder().encode(commandTemplate)
    );

    this.logger.info(
      `Command ${this.name} created successfully at ${this.path}`
    );
  }

  static getCommandTemplate() {
    return `import { Command } from "balda";

export default class extends Command {
  static commandName = "${this.name}";
  static description = "${this.description}";

  static options = {};

  static async handle(): Promise<void> {
    // Implement your command logic here
  }
}`;
  }
}
