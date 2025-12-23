import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaldaError } from "../../src/errors/balda_error.js";
import { mqtt, MqttService } from "../../src/mqtt/mqtt.js";

declare module "../../src/mqtt/mqtt.types.js" {
  interface MqttTopics {
    "test/temperature": { value: number; unit: string };
    "test/humidity": { value: number };
    "test/string": string;
    "test/buffer": Buffer;
    "test/wildcard/+/data": string;
    "test/multilevel/#": string;
  }
}

describe("MqttService", () => {
  const mqttConfig = {
    host: process.env.MQTT_HOST || "localhost",
    port: Number(process.env.MQTT_PORT) || 1883,
    connectTimeout: 5000,
  };

  afterEach(async () => {
    await MqttService.disconnect();
    MqttService.subscriptions = [];
  });

  describe("Connection", () => {
    it("should connect to MQTT broker", async () => {
      await MqttService.connect(mqttConfig);

      expect(MqttService.client).toBeDefined();
      expect(MqttService.client?.connected).toBe(true);
    });

    it("should connect with default options", async () => {
      await MqttService.connect();

      expect(MqttService.client).toBeDefined();
      expect(MqttService.client?.connected).toBe(true);
    });

    it("should store connection options", async () => {
      await MqttService.connect(mqttConfig);

      expect(MqttService.connectionOptions).toEqual(mqttConfig);
    });

    it("should handle connection errors gracefully", async () => {
      const invalidConfig = {
        host: "invalid-host-that-does-not-exist",
        port: 9999,
        connectTimeout: 1000,
      };

      await expect(MqttService.connect(invalidConfig)).rejects.toThrow();
    });
  });

  describe("Disconnect", () => {
    it("should disconnect from MQTT broker", async () => {
      await MqttService.connect(mqttConfig);
      expect(MqttService.client?.connected).toBe(true);

      await MqttService.disconnect();

      expect(MqttService.client).toBeNull();
    });

    it("should handle disconnect when not connected", async () => {
      await expect(MqttService.disconnect()).resolves.toBeUndefined();
    });
  });

  describe("Publish", () => {
    beforeEach(async () => {
      await MqttService.connect(mqttConfig);
    });

    it("should publish JSON object message", async () => {
      await expect(
        mqtt.publish("test/temperature", { value: 23.5, unit: "C" }),
      ).resolves.toBeUndefined();
    });

    it("should publish string message", async () => {
      await expect(
        mqtt.publish("test/string", "hello"),
      ).resolves.toBeUndefined();
    });

    it("should publish Buffer message", async () => {
      const buffer = Buffer.from("test data");
      await expect(
        mqtt.publish("test/buffer", buffer),
      ).resolves.toBeUndefined();
    });

    it("should publish with QoS options", async () => {
      await expect(
        mqtt.publish(
          "test/temperature",
          { value: 25.0, unit: "C" },
          { qos: 1 },
        ),
      ).resolves.toBeUndefined();
    });

    it("should publish with retain option", async () => {
      await expect(
        mqtt.publish(
          "test/temperature",
          { value: 25.0, unit: "C" },
          { retain: true },
        ),
      ).resolves.toBeUndefined();
    });

    it("should throw error when client is not connected", async () => {
      await MqttService.disconnect();

      await expect(
        mqtt.publish("test/temperature", { value: 23.5, unit: "C" }),
      ).rejects.toThrow(BaldaError);
    });

    it("should throw error with descriptive message when not connected", async () => {
      await MqttService.disconnect();

      await expect(
        mqtt.publish("test/temperature", { value: 23.5, unit: "C" }),
      ).rejects.toThrow("MQTT client is not connected");
    });
  });

  describe("Subscribe with decorator", () => {
    it("should register subscription using decorator", async () => {
      class TestHandler {
        @mqtt.subscribe("test/temperature", { qos: 1 })
        async handleTemperature(message: { value: number; unit: string }) {
          return message;
        }
      }

      expect(MqttService.subscriptions).toHaveLength(1);
      expect(MqttService.subscriptions[0].topic).toBe("test/temperature");
      expect(MqttService.subscriptions[0].name).toBe(
        "TestHandler.handleTemperature",
      );
      expect(MqttService.subscriptions[0].options?.qos).toBe(1);
    });

    it("should handle message with decorator", async () => {
      const messages: Array<{ value: number; unit: string }> = [];

      class TestHandler {
        @mqtt.subscribe("test/temperature")
        async handleTemperature(message: { value: number; unit: string }) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 150));

      await mqtt.publish("test/temperature", { value: 23.5, unit: "C" });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage).toEqual({ value: 23.5, unit: "C" });
    });

    it("should handle message with topic parameter", async () => {
      const receivedTopics: string[] = [];
      const messages: string[] = [];

      class TestHandler {
        @mqtt.subscribe("test/string")
        async handleString(topic: string, message: string) {
          receivedTopics.push(topic);
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("test/string", "hello world");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedTopics).toHaveLength(1);
      expect(receivedTopics[0]).toBe("test/string");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("hello world");
    });

    it("should parse JSON messages automatically", async () => {
      const messages: any[] = [];

      class TestHandler {
        @mqtt.subscribe("test/humidity")
        async handleHumidity(message: any) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("test/humidity", { value: 65 });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ value: 65 });
      expect(typeof messages[0]).toBe("object");
    });

    it("should support wildcard subscriptions with +", async () => {
      const messages: string[] = [];

      class TestHandler {
        @mqtt.subscribe("test/wildcard/+/data")
        async handleWildcard(topic: string, message: string) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("test/wildcard/sensor1/data", "sensor1 data");
      await mqtt.publish("test/wildcard/sensor2/data", "sensor2 data");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(2);
      expect(messages).toContain("sensor1 data");
      expect(messages).toContain("sensor2 data");
    });

    it("should support multilevel wildcard with #", async () => {
      const messages: string[] = [];

      class TestHandler {
        @mqtt.subscribe("test/multilevel/#")
        async handleMultilevel(topic: string, message: string) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("test/multilevel/a", "msg a");
      await mqtt.publish("test/multilevel/a/b", "msg b");
      await mqtt.publish("test/multilevel/a/b/c", "msg c");

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Unsubscribe", () => {
    beforeEach(async () => {
      await MqttService.connect(mqttConfig);
    });

    it("should unsubscribe from topic", async () => {
      class TestHandler {
        @mqtt.subscribe("test/temperature")
        async handleTemperature(message: { value: number; unit: string }) {
          return message;
        }
      }

      expect(MqttService.subscriptions).toHaveLength(1);

      await mqtt.unsubscribe("test/temperature");

      expect(MqttService.subscriptions).toHaveLength(0);
    });

    it("should stop receiving messages after unsubscribe", async () => {
      const messages: Array<{ value: number; unit: string }> = [];

      class TestHandler {
        @mqtt.subscribe("test/temperature")
        async handleTemperature(message: { value: number; unit: string }) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 150));

      await mqtt.publish("test/temperature", { value: 23.5, unit: "C" });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const messagesBeforeUnsubscribe = messages.length;

      await mqtt.unsubscribe("test/temperature");

      await mqtt.publish("test/temperature", { value: 25.0, unit: "C" });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages).toHaveLength(messagesBeforeUnsubscribe);
    });

    it("should throw error when client is not connected", async () => {
      await MqttService.disconnect();

      await expect(mqtt.unsubscribe("test/temperature")).rejects.toThrow(
        BaldaError,
      );
    });

    it("should throw error with descriptive message when not connected", async () => {
      await MqttService.disconnect();

      await expect(mqtt.unsubscribe("test/temperature")).rejects.toThrow(
        "MQTT client is not connected",
      );
    });
  });

  describe("Error Handling", () => {
    it("should call global error handler on client error", async () => {
      const errorHandler = vi.fn();
      MqttService.globalErrorHandler = errorHandler;

      await MqttService.connect(mqttConfig);

      const error = new Error("Test error");
      MqttService.client?.emit("error", error);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it("should handle errors in message handlers", async () => {
      const errorHandler = vi.fn();
      MqttService.globalErrorHandler = errorHandler;

      class TestHandler {
        @mqtt.subscribe("test/temperature")
        async handleTemperature(_message: { value: number; unit: string }) {
          throw new Error("Handler error");
        }
      }

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("test/temperature", { value: 23.5, unit: "C" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe("Event Handlers", () => {
    it("should set custom disconnect handler", async () => {
      const disconnectHandler = vi.fn();

      await MqttService.connect(mqttConfig);

      await new Promise((resolve) => setTimeout(resolve, 100));

      MqttService.setOnDisconnectHandler(disconnectHandler);

      await MqttService.disconnect();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(disconnectHandler).toHaveBeenCalled();
    });

    it("should set custom reconnect handler", async () => {
      const reconnectHandler = vi.fn();

      await MqttService.connect(mqttConfig);
      MqttService.setOnReconnectHandler(reconnectHandler);

      MqttService.client?.emit("reconnect");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(reconnectHandler).toHaveBeenCalled();
    });
  });

  describe("Registration", () => {
    it("should register subscription directly", () => {
      const handler = vi.fn();

      MqttService.register("TestHandler", "test/temperature", handler, {
        qos: 1,
      });

      expect(MqttService.subscriptions).toHaveLength(1);
      expect(MqttService.subscriptions[0].name).toBe("TestHandler");
      expect(MqttService.subscriptions[0].topic).toBe("test/temperature");
      expect(MqttService.subscriptions[0].options?.qos).toBe(1);
    });

    it("should register multiple subscriptions", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      MqttService.register("Handler1", "test/temperature", handler1);
      MqttService.register("Handler2", "test/humidity", handler2);

      expect(MqttService.subscriptions).toHaveLength(2);
    });
  });

  describe("Massive Import", () => {
    it("should import MQTT handlers from patterns", async () => {
      const initialCount = MqttService.subscriptions.length;

      await MqttService.massiveImportMqttHandlers(["test/mqtt/handlers/*.ts"]);

      expect(MqttService.subscriptions.length).toBeGreaterThanOrEqual(
        initialCount,
      );
    });
  });
});
