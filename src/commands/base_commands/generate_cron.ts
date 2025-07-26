import { join } from "node:path";
import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";

export default class GenerateCron extends Command {
  static commandName = "generate-cron";
  static description = "Generate a new cron job in the specified path";
  static help = [
    "Generate a new cron job in the specified path",
    "Example: npx balda generate-cron my-cron -p src/cron",
  ];

  @arg({
    description: "The name of the cron job file to generate",
    required: true,
  })
  static fileName: string;

  @flag({
    description: "The path to the cron job to generate, default is src/cron",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/cron",
  })
  static path: string;

  static async handle(): Promise<void> {
    const cronTemplate = this.getCronTemplate();
    this.path = join(this.path, `${this.fileName}.ts`);
    await nativeFs.writeFile(this.path, new TextEncoder().encode(cronTemplate));

    this.logger.info(
      `Cron job ${this.fileName} created successfully at ${this.path}`,
    );
  }

  static getCronTemplate() {
    return `import { cron } from "balda-js";

export default class {
  @cron("* * * * *")
  handle() {
    // Implement your cron job logic here
  }
}`;
  }
}
