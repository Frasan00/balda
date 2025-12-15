import type { SQSClientConfig } from "@aws-sdk/client-sqs";
import type { QueueTopicKey } from "../../queue_types.js";
import type { SyncOrAsync } from "../../../type_util.js";

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
