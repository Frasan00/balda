import { flag } from "../../decorators/command/flag.js";
import {
  execWithPrompt,
  getPackageManager,
  getUninstalledPackages,
} from "../../package.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Command } from "../base_command.js";

export default class InitQueueCommand extends Command {
  static commandName = "init-queue";
  static description =
    "Initialize queue provider configuration with required dependencies";
  static help = [
    "Initialize a queue provider configuration file with basic credentials",
    "Automatically installs required packages for the selected provider",
    "Only scaffolds the connection, handlers should be created with generate-queue command",
    "Example: npx balda init-queue -t bullmq -o src/queue",
  ];

  @flag.string({
    description: "Queue provider type (bullmq, sqs, pgboss) - required",
    aliases: "t",
    name: "type",
    required: true,
  })
  static queueType: "bullmq" | "sqs" | "pgboss";

  @flag.string({
    description:
      "Output directory for queue configuration, default is src/queue",
    aliases: "o",
    name: "output",
    required: false,
    defaultValue: "src/queue",
  })
  static outputPath: string;

  static queueDependencies: Record<string, string[]> = {
    bullmq: ["bullmq", "ioredis"],
    sqs: ["@aws-sdk/client-sqs", "sqs-consumer"],
    pgboss: ["pg-boss", "pg"],
  };

  static async handle(): Promise<void> {
    this.logger.info(`Initializing ${this.queueType} queue provider...`);

    if (!["bullmq", "sqs", "pgboss"].includes(this.queueType)) {
      this.logger.error(
        `Invalid queue type: ${this.queueType}. Must be one of: bullmq, sqs, pgboss`,
      );
      return;
    }

    const [packageManager, packageManagerCommand] = await getPackageManager();

    // Install dependencies if on npm, yarn, or pnpm
    if (["npm", "yarn", "pnpm"].includes(packageManager)) {
      const dependencies = this.queueDependencies[this.queueType];
      const uninstalledDeps = await getUninstalledPackages(dependencies);

      if (uninstalledDeps.length > 0) {
        this.logger.info(
          `Found ${uninstalledDeps.length} missing dependencies for ${this.queueType}`,
        );
        const installed = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} ${uninstalledDeps.join(" ")}`,
          packageManager,
          uninstalledDeps,
          {
            stdio: "inherit",
          },
          false,
        );

        if (!installed) {
          this.logger.info(
            "Installation cancelled by user. Queue initialization aborted.",
          );
          return;
        }
      }

      if (uninstalledDeps.length === 0) {
        this.logger.info(
          `All ${this.queueType} dependencies are already installed`,
        );
      }
    }

    const configTemplate = this.getConfigTemplate();
    const fileName = `${this.queueType}.config.ts`;
    const fullPath = nativePath.join(this.outputPath, fileName);

    if (!(await nativeFs.exists(this.outputPath))) {
      await nativeFs.mkdir(this.outputPath, { recursive: true });
    }

    this.logger.info(`Creating ${fileName} file at ${this.outputPath}...`);
    await nativeFs.writeFile(
      fullPath,
      new TextEncoder().encode(configTemplate),
    );

    this.logger.info(
      `Queue configuration initialized successfully at ${fullPath}`,
    );
    this.logger.info(
      `Remember to update the configuration with your actual credentials`,
    );
    this.logger.info(`Use 'npx balda generate-queue' to create queue handlers`);
  }

  static getConfigTemplate(): string {
    if (this.queueType === "bullmq") {
      return this.getBullMQTemplate();
    }

    if (this.queueType === "sqs") {
      return this.getSQSTemplate();
    }

    if (this.queueType === "pgboss") {
      return this.getPGBossTemplate();
    }

    return "";
  }

  static getBullMQTemplate(): string {
    return `import { defineBullMQConfiguration } from "balda-js";

defineBullMQConfiguration({
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
  errorHandler: async (job, error) => {
    console.error(\`Job \${job.id} failed:\`, error);
  },
});
`;
  }

  static getSQSTemplate(): string {
    return `import { defineSQSConfiguration } from "balda-js";

defineSQSConfiguration({
  client: {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  },
  consumer: {
    batchSize: 10,
    visibilityTimeout: 30,
    waitTimeSeconds: 20,
    queueUrlMap: {
      // Map your queue topics to SQS queue URLs
      // Example: "user-notifications": process.env.USER_NOTIFICATIONS_QUEUE_URL || "",
    },
  },
  errorHandler: (error) => {
    console.error("SQS error:", error);
  },
});
`;
  }

  static getPGBossTemplate(): string {
    return `import { definePGBossConfiguration } from "balda-js";

definePGBossConfiguration({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://user:password@localhost:5432/database",
  errorHandler: (error) => {
    console.error("PG-Boss error:", error);
  },
});
`;
  }
}
