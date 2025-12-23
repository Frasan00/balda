import type {
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
} from "mqtt";

export interface MqttTopics {}

/**
 * Expands MQTT wildcard patterns to allow publishing to concrete topics
 * - "test/wildcard/+/data" allows "test/wildcard/anything/data"
 * - "test/multilevel/#" allows "test/multilevel/anything/else"
 */
type ExpandWildcardTopic<T extends string> =
  T extends `${infer Before}/+/${infer After}`
    ? `${Before}/${string}/${ExpandWildcardTopic<After>}`
    : T extends `${infer Before}/+`
      ? `${Before}/${string}`
      : T extends `${infer Before}/#`
        ? `${Before}/${string}`
        : T;

/**
 * Expands all wildcard topics in MqttTopics interface
 */
export type ExpandedMqttTopics<T extends MqttTopics> = {
  [K in keyof T as K extends string ? ExpandWildcardTopic<K> : K]: T[K];
};

/**
 * Union of exact topic keys and expanded wildcard topics
 */
export type PublishTopic<T extends MqttTopics> =
  | keyof T
  | keyof ExpandedMqttTopics<T>;

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
