import type { Message, SQSClient, SQSClientConfig } from "@aws-sdk/client-sqs";
import type { Consumer, ConsumerOptions } from "sqs-consumer";
import { ClientNotFoundError } from "../../../errors/client_not_found_error.js";
import { SQSConfiguration } from "./sqs_configuration.js";
import type {
  PublishOptions,
  PubSub,
  QueueTopic,
  QueueTopicKey,
  SQSPublishOptions,
} from "../../queue_types.js";

export class SQSPubSub implements PubSub<"sqs"> {
  private consumers: Map<string, Consumer> = new Map();
  private client?: SQSClient;
  declare private sqsLib: typeof import("@aws-sdk/client-sqs");
  declare private sqsConsumerLib: typeof import("sqs-consumer");

  async publish<T extends QueueTopicKey>(
    topic: T,
    payload: QueueTopic[T],
    options?: PublishOptions<"sqs">,
  ): Promise<{ id: string }> {
    const { ...rest } = options ?? {};

    const sqs = await this.getClient();
    const { SendMessageCommand } = await this.getSqsLib();
    const queueUrl = await this.resolveQueueUrl(String(topic));
    if (!queueUrl) {
      throw new Error(
        `[SQS] Queue url not configured for topic "${String(topic)}"`,
      );
    }

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        topic: { DataType: "String", StringValue: String(topic) },
      },
      ...(rest as SQSPublishOptions),
      QueueUrl: queueUrl,
    });

    const response = await sqs.send(command);
    return { id: response.MessageId ?? "" };
  }

  async subscribe<T extends QueueTopicKey>(
    topic: T,
    handler: (payload: QueueTopic[T]) => Promise<void>,
  ): Promise<void> {
    if (this.consumers.has(String(topic))) {
      throw new Error(`[SQS] Already subscribed to topic "${String(topic)}"`);
    }

    const options = SQSConfiguration.options;
    const consumerModule = await this.getSqsConsumerLib();
    const consumerOptions: ConsumerOptions & { queueUrl: string } = {
      ...(options.consumer || {}),
      sqs: await this.getClient(),
      queueUrl: await this.resolveQueueUrl(String(topic)),
      handleMessage: async (message: Message) => {
        const payload = JSON.parse(message.Body || "{}");
        await handler(payload);
      },
    } as any;

    const consumer = consumerModule.Consumer.create(consumerOptions);
    const errorHandler = options.errorHandler;
    if (errorHandler) {
      consumer.on("error", errorHandler);
      consumer.on("processing_error", errorHandler);
    }

    consumer.start();
    this.consumers.set(String(topic), consumer);
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
    const url = (attrs as any)?.queueUrlMap?.[topic] as string | undefined;
    if (!url) {
      throw new Error(`[SQS] Queue url not configured for topic "${topic}"`);
    }
    return url;
  }
}
