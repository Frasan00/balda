import type { SQSClientConfig } from "@aws-sdk/client-sqs";
import type { QueueTopicKey } from "src/queue/queue_types";
import type { SyncOrAsync } from "src/type_util";

export type SQSConfigurationOptions = {
  client?: SQSClientConfig;
  consumer?: {
    batchSize?: number;
    visibilityTimeout?: number;
    waitTimeSeconds?: number;
    queueUrlMap: Record<QueueTopicKey, string>;
  };
  errorHandler?: (error: Error) => SyncOrAsync;
};

export class SQSConfiguration {
  static options: SQSConfigurationOptions = {};
}

export const defineSQSConfiguration = (
  options: SQSConfigurationOptions,
): void => {
  SQSConfiguration.options = options ?? {};
};
