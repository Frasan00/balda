import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { toLowerSnakeCase } from "../../utils.js";
import { Command } from "../base_command.js";

export default class GenerateQueueCommand extends Command {
  static commandName = "generate-queue";
  static description = "Generate a new queue in the specified path";
  static help = [
    "Generate a new queue in the specified path",
    "Example: npx balda generate-queue my-queue -p src/queues --provider bullmq",
  ];

  @arg({
    description: "The name of the queue to generate",
    required: true,
  })
  static queueName: string;

  @flag({
    description: "The path to the queue to generate, default is src/queues",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/queues",
  })
  static path: string;

  @flag({
    description: "The provider of the queue to generate, default is bullmq",
    type: "string",
    aliases: ["pr"],
    name: "provider",
    required: false,
    defaultValue: "bullmq",
  })
  static provider: string;

  static async handle(): Promise<void> {
    const isValidLiteral = this.queueName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    const queueTemplate = this.getQueueTemplate(!!isValidLiteral);
    this.path = nativePath.join(
      this.path,
      `${toLowerSnakeCase(this.queueName)}.ts`,
    );

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
      new TextEncoder().encode(queueTemplate),
    );

    this.logger.info(
      `Queue ${this.queueName} created successfully at ${this.path}`,
    );
  }

  static getQueueTemplate(isValidLiteral: boolean) {
    return `import { BaseQueue, queue } from "balda";

export type Payload = {
  // Add your payload here
};

declare module "balda" {
  export interface QueueTopic {
    ${isValidLiteral ? this.queueName : `'${this.queueName}'`}: Payload;
  }
}

export default class extends BaseQueue {
  @queue('${this.provider}', '${this.queueName}')
  async handle(payload: Payload) {
    // Implement your queue logic here
    this.logger.info({ payload }, 'Payload received');
    return Promise.resolve();
  }
}`;
  }
}
