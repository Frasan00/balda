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
    return `import { defineBullMQConfiguration } from "balda";

// Configure BullMQ connection and default options
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

/**
 * Best Practice: Create a centralized queue registry
 * Define all your queues in one place for better organization and type safety
 *
 * Example usage:
 *
 * // queues.ts
 * import { bullmqQueue } from "balda";
 *
 * export const queues = {
 *   emailNotifications: bullmqQueue<{ email: string; subject: string }>("email-notifications"),
 *   orderProcessing: bullmqQueue<{ orderId: string; userId: string }>("order-processing"),
 * };
 *
 * // Publish to queue
 * await queues.emailNotifications.publish({
 *   email: "user@example.com",
 *   subject: "Welcome!"
 * });
 *
 * // Subscribe with decorator
 * import { queues } from "./queues.js";
 *
 * export class EmailHandler {
 *   @queues.emailNotifications.subscribe()
 *   async handle(payload: { email: string; subject: string }) {
 *     console.log("Sending email:", payload);
 *   }
 * }
 *
 * // Or subscribe with callback
 * await queues.emailNotifications.subscribe(async (payload) => {
 *   console.log("Processing:", payload);
 * });
 */
`;
  }

  static getSQSTemplate(): string {
    return `import { defineSQSConfiguration } from "balda";

// Configure SQS connection and consumer options
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

/**
 * Best Practice: Create a centralized queue registry
 * Define all your queues in one place for better organization and type safety
 *
 * Example usage:
 *
 * // queues.ts
 * import { sqsQueue } from "balda";
 *
 * export const queues = {
 *   emailNotifications: sqsQueue<{ email: string; subject: string }>(
 *     "email-notifications",
 *     { queueUrl: process.env.EMAIL_QUEUE_URL || "" }
 *   ),
 *   orderProcessing: sqsQueue<{ orderId: string; userId: string }>(
 *     "order-processing",
 *     { queueUrl: process.env.ORDER_QUEUE_URL || "" }
 *   ),
 * };
 *
 * // Publish to queue
 * await queues.emailNotifications.publish({
 *   email: "user@example.com",
 *   subject: "Welcome!"
 * });
 *
 * // Subscribe with decorator
 * import { queues } from "./queues.js";
 *
 * export class EmailHandler {
 *   @queues.emailNotifications.subscribe()
 *   async handle(payload: { email: string; subject: string }) {
 *     console.log("Sending email:", payload);
 *   }
 * }
 *
 * // Or subscribe with callback
 * await queues.emailNotifications.subscribe(async (payload) => {
 *   console.log("Processing:", payload);
 * });
 */
`;
  }

  static getPGBossTemplate(): string {
    return `import { definePGBossConfiguration } from "balda";

// Configure PGBoss connection
definePGBossConfiguration({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://user:password@localhost:5432/database",
  errorHandler: (error) => {
    console.error("PG-Boss error:", error);
  },
});

/**
 * Best Practice: Create a centralized queue registry
 * Define all your queues in one place for better organization and type safety
 *
 * Example usage:
 *
 * // queues.ts
 * import { pgbossQueue } from "balda";
 *
 * export const queues = {
 *   emailNotifications: pgbossQueue<{ email: string; subject: string }>("email-notifications"),
 *   orderProcessing: pgbossQueue<{ orderId: string; userId: string }>("order-processing"),
 * };
 *
 * // Publish to queue
 * await queues.emailNotifications.publish({
 *   email: "user@example.com",
 *   subject: "Welcome!"
 * });
 *
 * // Subscribe with decorator
 * import { queues } from "./queues.js";
 *
 * export class EmailHandler {
 *   @queues.emailNotifications.subscribe()
 *   async handle(payload: { email: string; subject: string }) {
 *     console.log("Sending email:", payload);
 *   }
 * }
 *
 * // Or subscribe with callback
 * await queues.emailNotifications.subscribe(async (payload) => {
 *   console.log("Processing:", payload);
 * });
 */
`;
  }
}
