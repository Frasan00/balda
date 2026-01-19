import { glob } from "glob";
import type { IClientSubscribeOptions, MqttClient } from "mqtt";
import { BaldaError } from "../errors/balda_error.js";
import { logger } from "../logger/logger.js";
import { nativeCwd } from "../runtime/native_cwd.js";
import { SyncOrAsync } from "../type_util.js";
import type {
  MqttConnectionOptions,
  MqttHandler,
  MqttPublishOptions,
  MqttSubscription,
  MqttTopics,
} from "./mqtt.types.js";

/**
 * Parse MQTT message payload
 * @internal
 * Attempts to parse in order: JSON object -> string -> Buffer
 */
const parseMessage = (
  message: Buffer,
): Buffer | Record<string, any> | string => {
  if (!Buffer.isBuffer(message)) {
    return message;
  }

  const stringValue = message.toString();

  if (!stringValue.length) {
    return stringValue;
  }

  try {
    const parsed = JSON.parse(stringValue);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return stringValue;
  } catch {
    return stringValue;
  }
};

export class MqttService {
  static subscriptions: MqttSubscription<MqttTopics>[] = [];
  static client: MqttClient | null = null;
  static connectionOptions: MqttConnectionOptions = {};
  private static readonly logger = logger.child({ scope: "MqttService" });

  /**
   * @description Register an MQTT subscription handler.
   * @internal
   * @example
   * MqttService.register('test', 'home/temperature', (topic, message) => {
   *   console.log('Received message:', message.toString());
   * }, { qos: 1 });
   */
  static register<T extends MqttTopics>(
    name: string,
    topic: keyof T,
    handler: MqttHandler<T>,
    options?: IClientSubscribeOptions,
  ): void {
    this.subscriptions.push({
      name,
      topic: topic as never,
      handler: handler as unknown as MqttHandler<MqttTopics>,
      options,
    });
  }

  /**
   * @description Connect to the MQTT broker and subscribe to all registered topics.
   */
  static async connect(
    connectionOptions: MqttConnectionOptions = {},
  ): Promise<void> {
    const mqttModule = await import("mqtt").catch(() => {
      throw new BaldaError(
        "mqtt not installed as a dependency, it is required in order to use MQTT subscriptions with the @mqtt decorator",
      );
    });

    this.connectionOptions = connectionOptions;

    this.logger.info("Starting MQTT client");
    if (!this.subscriptions.length) {
      this.logger.info("No MQTT subscriptions to register");
    }

    const {
      host = process.env.MQTT_HOST || "localhost",
      port = Number(process.env.MQTT_PORT) || 1883,
      protocol = "mqtt",
      ...otherOptions
    } = connectionOptions;

    const brokerUrl = `${protocol}://${host}:${port}`;
    this.client = await mqttModule.connectAsync(brokerUrl, otherOptions);

    this.logger.info("MQTT client connected");

    // Set up event handlers
    this.client.on("error", async (error) => {
      await this.globalErrorHandler(error);
    });

    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on("disconnect", () => {
      this.logger.info("MQTT client disconnected");
    });

    this.client.on("reconnect", async () => {
      await this.globalErrorHandler(new Error("MQTT client reconnecting"));
    });

    // Subscribe to all registered topics (client is already connected)
    this.subscribeToTopics();
  }

  /**
   * @description Subscribe to all registered topics.
   * @internal
   */
  private static subscribeToTopics() {
    if (!this.client) {
      return;
    }

    for (const { name, topic, options } of this.subscriptions) {
      this.logger.info(`Subscribing to MQTT topic: ${topic} (${name})`);
      this.client.subscribe(topic, options || {}, (error) => {
        if (error) {
          this.logger.error(
            `Failed to subscribe to topic ${topic}: ${error.message}`,
          );
          return;
        }
        this.logger.info(`Successfully subscribed to topic: ${topic}`);
      });
    }
  }

  /**
   * @description Handle incoming MQTT messages.
   * @internal
   */
  private static async handleMessage(topic: string | never, message: Buffer) {
    const matchingSubscriptions = this.subscriptions.filter((sub) => {
      if (sub.topic === topic) {
        return true;
      }

      if (!topic || typeof topic !== "string") {
        return false;
      }

      const topicPattern = (sub.topic as string)
        .replace(/\+/g, "[^/]+")
        .replace(/#$/, ".*");
      const regex = new RegExp(`^${topicPattern}$`);
      return regex.test(topic);
    });

    for (const subscription of matchingSubscriptions) {
      try {
        await subscription.handler(
          topic as keyof MqttTopics,
          message as unknown as MqttTopics[keyof MqttTopics],
        );
      } catch (error) {
        this.logger.error(
          `Error handling MQTT message for topic ${topic} in ${subscription.name}`,
        );
        this.globalErrorHandler(error as Error);
      }
    }
  }

  /**
   * @description Main error handler for MQTT operations. You can write your own error handler by overriding this static method for example with sentry.
   */
  static globalErrorHandler(error: Error): SyncOrAsync<void> {
    this.logger.error(error);
  }

  static setOnDisconnectHandler(handler: () => void) {
    this.client?.on("disconnect", handler);
  }

  static setOnReconnectHandler(handler: () => void) {
    this.client?.on("reconnect", handler);
  }

  /**
   * @description Import all MQTT handlers from specified patterns
   */
  static async massiveImportMqttHandlers(mqttHandlerPatterns: string[]) {
    const allFiles: string[] = [];

    for (const pattern of mqttHandlerPatterns) {
      const files = await glob(pattern, {
        absolute: true,
        cwd: nativeCwd.getCwd(),
      });

      allFiles.push(...files);
    }

    await Promise.all(
      allFiles.map(async (file) => {
        await import(file).catch((error) => {
          this.logger.error(`Error importing MQTT handler: ${file}`);
          this.logger.error(error);
        });
      }),
    );
  }

  /**
   * Create a decorator to subscribe to an MQTT topic
   * Messages are automatically parsed: Buffer -> JSON object (if valid) -> string
   * Supports MQTT wildcards: + (single level) and # (multi level)
   *
   * Handler signature can be either:
   * - `handler(message: T)` - just the message (topic omitted)
   * - `handler(topic: string, message: T)` - include topic for wildcards or logging
   *
   * @example
   * @mqtt.handler('home/temperature', { qos: 1 })
   * handleTemperature(message: { value: number; unit: string }) {
   *   console.log('Temperature:', message.value, message.unit);
   * }
   *
   * @example With topic parameter (useful for wildcards)
   * @mqtt.handler('home/+/temperature', { qos: 1 })
   * handleRoomTemperature(topic: string, message: string) {
   *   const room = topic.split('/')[1];
   *   console.log(`${room} temperature:`, message);
   * }
   */
  subscribe<T extends MqttTopics = MqttTopics>(
    topic: keyof T,
    options?: IClientSubscribeOptions,
  ) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
      const originalMethod = descriptor.value;

      if (!originalMethod) {
        return descriptor;
      }

      const wrappedMethod = async (
        msgTopic: string,
        rawMessage: Buffer,
      ): Promise<void> => {
        const instance = new target.constructor();
        const parsedMessage = parseMessage(rawMessage);

        if (originalMethod.length === 1) {
          await originalMethod.call(instance, parsedMessage);
          return;
        }

        await originalMethod.call(instance, msgTopic, parsedMessage);
      };

      MqttService.register(
        `${target.constructor.name}.${propertyKey}`,
        topic,
        wrappedMethod as unknown as MqttHandler<T>,
        options,
      );

      return descriptor;
    };
  }

  /**
   * @description Unsubscribe from an MQTT topic
   * @param topic - The topic to unsubscribe from
   * @throws BaldaError if the MQTT client is not connected
   * @example
   * await mqtt.unsubscribe('home/temperature');
   */
  async unsubscribe<T extends MqttTopics>(topic: keyof T): Promise<void> {
    if (!MqttService.client) {
      throw new BaldaError(
        "MQTT client is not connected. Call MqttService.connect() first.",
      );
    }

    if (!MqttService.client.connected) {
      throw new BaldaError(
        "MQTT client is not connected. Call MqttService.connect() first.",
      );
    }

    try {
      await MqttService.client.unsubscribeAsync(topic as string);

      MqttService.subscriptions = MqttService.subscriptions.filter(
        (sub) => sub.topic !== topic,
      );

      MqttService.logger.debug(`Unsubscribed from topic: ${String(topic)}`);
    } catch (error) {
      MqttService.logger.error(
        `Failed to unsubscribe from topic ${String(topic)}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * @description Publish a message to an MQTT topic
   * @param topic - The topic to publish to (supports wildcard expansions)
   * @param message - The message payload (string, Buffer, or object that will be JSON stringified)
   * @param options - Publish options (qos, retain, etc.)
   * @throws BaldaError if the MQTT client is not connected or is not installed as a dependency
   */
  async publish<T extends MqttTopics>(
    topic: import("./mqtt.types.js").PublishTopic<T>,
    message: T[keyof T],
    options?: MqttPublishOptions,
  ): Promise<void> {
    if (!MqttService.client) {
      throw new BaldaError(
        "MQTT client is not connected. Call MqttService.connect() first.",
      );
    }

    if (!MqttService.client.connected) {
      throw new BaldaError(
        "MQTT client is not connected. Call MqttService.connect() first.",
      );
    }

    let payload: string | Buffer;

    if (Buffer.isBuffer(message)) {
      payload = message;
    } else if (typeof message === "object") {
      payload = JSON.stringify(message);
    } else {
      payload = String(message);
    }

    try {
      await MqttService.client.publishAsync(
        topic as string,
        payload,
        options || {},
      );
      logger.debug(`Published message to topic: ${String(topic)}`);
    } catch (error) {
      logger.error(
        `Failed to publish to topic ${String(topic)}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * @description Disconnect the MQTT client gracefully
   */
  static async disconnect() {
    if (!this.client) {
      return;
    }

    return new Promise<void>((resolve) => {
      const client = this.client;
      client?.end(false, {}, () => {
        logger.info("MQTT client disconnected gracefully");
        client?.emit("disconnect", { cmd: "disconnect" });
        this.client = null;
        resolve();
      });
    });
  }
}

export const setMqttGlobalErrorHandler = (
  globalErrorHandler: (
    ...args: Parameters<(typeof MqttService)["globalErrorHandler"]>
  ) => void,
) => {
  MqttService.globalErrorHandler = globalErrorHandler.bind(MqttService);
};

/**
 * Singleton instance for publishing MQTT messages
 * @example
 * import { mqtt } from 'balda';
 *
 * await mqtt.publish('home/temperature', { value: 23.5, unit: 'C' }, { qos: 1 });
 */
export const mqtt = new MqttService();
