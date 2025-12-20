import type { Message, SQSClient, SQSClientConfig } from "@aws-sdk/client-sqs";
import type { Consumer, ConsumerOptions } from "sqs-consumer";
import { ClientNotFoundError } from "../../../errors/client_not_found_error.js";
import { SQSConfiguration } from "./sqs_configuration.js";
import type {
  GenericPubSub,
  PublishOptions,
  SQSPublishOptions,
  SQSQueueOptions,
} from "../../queue_types.js";

export class SQSPubSub implements GenericPubSub {
  private consumers: Map<string, Consumer> = new Map();
  private client?: SQSClient;
  declare private sqsLib: typeof import("@aws-sdk/client-sqs");
  declare private sqsConsumerLib: typeof import("sqs-consumer");

  // @ts-ignore
  async publish<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"sqs">,
  ): Promise<{ id: string }> {
    const { ...rest } = options ?? {};

    const sqs = await this.getClient();
    const { SendMessageCommand } = await this.getSqsLib();
    const queueUrl = await this.resolveQueueUrl(topic);
    if (!queueUrl) {
      throw new Error(`[SQS] Queue url not configured for topic "${topic}"`);
    }

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        topic: { DataType: "String", StringValue: topic },
      },
      ...(rest as SQSPublishOptions),
      QueueUrl: queueUrl,
    });

    const response = await sqs.send(command);
    return { id: response.MessageId ?? "" };
  }

  async subscribe<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void> {
    if (this.consumers.has(topic)) {
      throw new Error(`[SQS] Already subscribed to topic "${topic}"`);
    }

    const options = SQSConfiguration.options;
    const consumerModule = await this.getSqsConsumerLib();
    const consumerOptions: ConsumerOptions & { queueUrl: string } = {
      ...(options.consumer || {}),
      sqs: await this.getClient(),
      queueUrl: await this.resolveQueueUrl(topic),
      handleMessage: async (message: Message) => {
        const payload = JSON.parse(message.Body || "{}");
        await handler(payload);
      },
    } as ConsumerOptions & { queueUrl: string };

    const consumer = consumerModule.Consumer.create(consumerOptions);
    const errorHandler = options.errorHandler;
    if (errorHandler) {
      consumer.on("error", errorHandler);
      consumer.on("processing_error", errorHandler);
    }

    consumer.start();
    this.consumers.set(topic, consumer);
  }

  private async getClient(): Promise<SQSClient> {
    if (this.client) {
      return this.client;
    }

    const { SQSClient } = await this.getSqsLib();
    const config: SQSClientConfig | undefined = SQSConfiguration.options.client;
    this.client = new SQSClient(config ?? {});
    return this.client;
  }

  private async getSqsLib(): Promise<typeof import("@aws-sdk/client-sqs")> {
    if (!this.sqsLib) {
      this.sqsLib = await import("@aws-sdk/client-sqs").catch(() => {
        throw new ClientNotFoundError("@aws-sdk/client-sqs", "sqs-consumer");
      });
    }

    return this.sqsLib;
  }

  private async getSqsConsumerLib(): Promise<typeof import("sqs-consumer")> {
    if (!this.sqsConsumerLib) {
      this.sqsConsumerLib = await import("sqs-consumer").catch(() => {
        throw new ClientNotFoundError("sqs-consumer");
      });
    }

    return this.sqsConsumerLib;
  }

  private async resolveQueueUrl(topic: string): Promise<string> {
    const attrs = SQSConfiguration.options.consumer;
    const url = (attrs as Record<string, unknown> | undefined)?.queueUrlMap as
      | Record<string, string>
      | undefined;
    if (!url?.[topic]) {
      throw new Error(`[SQS] Queue url not configured for topic "${topic}"`);
    }
    return url[topic];
  }

  // Methods for TypedQueue with per-queue config
  async publishWithConfig<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"sqs">,
    queueConfig?: SQSQueueOptions,
  ): Promise<{ id: string }> {
    const { ...rest } = options ?? {};

    const sqs = await this.getClientWithConfig(queueConfig?.client);
    const { SendMessageCommand } = await this.getSqsLib();

    // Use queueConfig.queueUrl if provided, otherwise fall back to global config
    const queueUrl =
      queueConfig?.queueUrl ?? (await this.resolveQueueUrl(topic));

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        topic: { DataType: "String", StringValue: topic },
      },
      ...(rest as SQSPublishOptions),
      QueueUrl: queueUrl,
    });

    const response = await sqs.send(command);
    return { id: response.MessageId ?? "" };
  }

  async subscribeWithConfig<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
    queueConfig?: SQSQueueOptions,
  ): Promise<void> {
    if (this.consumers.has(topic)) {
      throw new Error(`[SQS] Already subscribed to topic "${topic}"`);
    }

    const globalOptions = SQSConfiguration.options;
    const consumerModule = await this.getSqsConsumerLib();

    // Use queueConfig.queueUrl if provided, otherwise fall back to global config
    const queueUrl =
      queueConfig?.queueUrl ?? (await this.resolveQueueUrl(topic));

    const consumerOptions: ConsumerOptions & { queueUrl: string } = {
      ...(globalOptions.consumer || {}),
      sqs: await this.getClientWithConfig(queueConfig?.client),
      queueUrl,
      handleMessage: async (message: Message) => {
        const payload = JSON.parse(message.Body || "{}");
        await handler(payload);
      },
    } as ConsumerOptions & { queueUrl: string };

    const consumer = consumerModule.Consumer.create(consumerOptions);
    const errorHandler = globalOptions.errorHandler;
    if (errorHandler) {
      consumer.on("error", errorHandler);
      consumer.on("processing_error", errorHandler);
    }

    consumer.start();
    this.consumers.set(topic, consumer);
  }

  private async getClientWithConfig(
    clientConfig?: SQSClientConfig,
  ): Promise<SQSClient> {
    // If custom client config is provided, create a new client
    if (clientConfig) {
      const { SQSClient } = await this.getSqsLib();
      return new SQSClient(clientConfig);
    }

    // Otherwise use the shared client
    return this.getClient();
  }
}
