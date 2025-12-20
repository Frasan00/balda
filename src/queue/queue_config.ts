import { defineBullMQConfiguration } from "./providers/bullmq/bullmq_configuration.js";
import type { CustomQueueConfiguration } from "./providers/custom/custom.js";
import { definePGBossConfiguration } from "./providers/pgboss/pgboss_configuration.js";
import { defineSQSConfiguration } from "./providers/sqs/sqs_configuration.js";
import { QueueManager } from "./queue.js";
import type { GenericPubSub, QueueProviderKey } from "./queue_types.js";

/**
 * Main entry point to define the queue configuration, meant to be called only once in the application bootstrap
 * @bullmq - The BullMQ configuration options
 * @pgboss - The PGBoss configuration options
 * @sqs - The SQS configuration options
 * @string - The custom queue provider name with it's PubSub implementation
 * @example
 * defineQueueConfiguration({
 *   bullmq: {
 *     connection: {
 *       host: "127.0.0.1",
 *       password: "root",
 *       username: "default",
 *       db: 0,
 *     },
 *   },
 *   pgboss: {
 *     connectionString: "postgres://root:root@localhost:5432/database",
 *   },
 *   sqs: {
 *     client: { region: "us-east-1" },
 *   },
 *   custom: new CustomPubSub(),
 * });
 * @example
 * defineQueueConfiguration({
 *   custom: new CustomPubSub(),
 * });
 */
export const defineQueueConfiguration = (
  options: {
    bullmq?: Parameters<typeof defineBullMQConfiguration>[0];
    pgboss?: Parameters<typeof definePGBossConfiguration>[0];
    sqs?: Parameters<typeof defineSQSConfiguration>[0];
  } & {
    [key in Exclude<
      QueueProviderKey,
      "bullmq" | "pgboss" | "sqs"
    >]?: CustomQueueConfiguration;
  },
): void => {
  const firstClassIntegrations = ["bullmq", "pgboss", "sqs"];
  if (options.bullmq) {
    defineBullMQConfiguration(options.bullmq);
  }
  if (options.pgboss) {
    definePGBossConfiguration(options.pgboss);
  }
  if (options.sqs) {
    defineSQSConfiguration(options.sqs);
  }

  for (const key of Object.keys(options)) {
    const provider = key as QueueProviderKey;
    if (!firstClassIntegrations.includes(provider)) {
      QueueManager.setProvider(
        provider,
        options[provider] as GenericPubSub<QueueProviderKey>,
      );
    }
  }
};
