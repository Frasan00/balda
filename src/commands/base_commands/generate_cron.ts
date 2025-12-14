import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";
import { nativePath } from "src/runtime/native_path";

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
    this.path = nativePath.join(this.path, `${this.fileName}.ts`);
    if (!(await nativeFs.exists(nativePath.join(process.cwd(), this.path)))) {
      await nativeFs.mkdir(
        nativePath.join(
          process.cwd(),
          this.path.split("/").slice(0, -1).join("/"),
        ),
        { recursive: true },
      );
    }

    await nativeFs.writeFile(this.path, new TextEncoder().encode(cronTemplate));

    this.logger.info(
      `Cron job ${this.fileName} created successfully at ${this.path}`,
    );
  }

  static getCronTemplate() {
    return `import { BaseCron, cron } from "balda-js";

export default class extends BaseCron {
  @cron("* * * * *")
  handle() {
    this.logger.info("Running cron job");
    // Implement your cron job logic here
  }
}`;
  }
}
