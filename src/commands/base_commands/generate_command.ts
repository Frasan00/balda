import { join } from "node:path";
import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { nativeFs } from "src/runtime/native_fs";

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
    const commandTemplate = this.getCommandTemplate();
    this.path = join(this.path, `${this.name}.ts`);

    if (!(await nativeFs.exists(join(process.cwd(), this.path)))) {
      await nativeFs.mkdir(
        join(process.cwd(), this.path.split("/").slice(0, -1).join("/")),
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
  static description = "${this.description}";

  static options: CommandOptions = {
    // Define your command options here
    stayAlive: false,
  };

  static async handle(): Promise<void> {
    // Implement your command logic here
  }
}`;
  }
}
