import type {
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
} from "mqtt";

export interface MqttTopics {}

export type MqttHandler<T extends MqttTopics> = (
  topic: keyof T,
  message: T[keyof T],
) => void | Promise<void>;

export type MqttSubscription<T extends MqttTopics> = {
  name: string;
  topic: keyof T;
  handler: MqttHandler<T>;
  options?: IClientSubscribeOptions;
};

export type MqttSubscribeOptions = IClientSubscribeOptions;

export type MqttPublishOptions = IClientPublishOptions;

export type MqttConnectionOptions = IClientOptions;
