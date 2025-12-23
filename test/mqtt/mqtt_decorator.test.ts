import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BaseMqtt } from "../../src/mqtt/base_mqtt.js";
import { mqtt, MqttService } from "../../src/mqtt/mqtt.js";

declare module "../../src/mqtt/mqtt.types.js" {
  interface MqttTopics {
    "decorator/test": { message: string };
    "decorator/string": string;
    "decorator/number": number;
    "decorator/complex": { id: number; data: { nested: string } };
  }
}

describe("MQTT Decorator", () => {
  const mqttConfig = {
    host: process.env.MQTT_HOST || "localhost",
    port: Number(process.env.MQTT_PORT) || 1883,
    connectTimeout: 5000,
  };

  beforeEach(() => {
    MqttService.subscriptions = [];
  });

  afterEach(async () => {
    await MqttService.disconnect();
    MqttService.subscriptions = [];
  });

  describe("Decorator Registration", () => {
    it("should register handler with decorator", () => {
      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          return message;
        }
      }

      expect(MqttService.subscriptions).toHaveLength(1);
      expect(MqttService.subscriptions[0].topic).toBe("decorator/test");
      expect(MqttService.subscriptions[0].name).toBe("TestHandler.handleTest");
    });

    it("should register multiple handlers in same class", () => {
      class MultiHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          return message;
        }

        @mqtt.subscribe("decorator/string")
        async handleString(message: string) {
          return message;
        }
      }

      expect(MqttService.subscriptions).toHaveLength(2);
    });

    it("should register handlers from multiple classes", () => {
      class Handler1 extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          return message;
        }
      }

      class Handler2 extends BaseMqtt {
        @mqtt.subscribe("decorator/string")
        async handleString(message: string) {
          return message;
        }
      }

      expect(MqttService.subscriptions).toHaveLength(2);
    });

    it("should preserve QoS options", () => {
      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test", { qos: 2 })
        async handleTest(message: { message: string }) {
          return message;
        }
      }

      expect(MqttService.subscriptions[0].options?.qos).toBe(2);
    });
  });

  describe("Message Handling", () => {
    it("should handle JSON object messages", async () => {
      const messages: Array<{ message: string }> = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/test", { message: "hello" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ message: "hello" });
    });

    it("should handle string messages", async () => {
      const messages: string[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/string")
        async handleString(message: string) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/string", "test string");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("test string");
    });

    it("should handle number messages", async () => {
      const messages: number[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/number")
        async handleNumber(message: number) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/number", 42);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("42");
    });

    it("should handle complex nested objects", async () => {
      const messages: Array<{ id: number; data: { nested: string } }> = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/complex")
        async handleComplex(message: { id: number; data: { nested: string } }) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/complex", {
        id: 1,
        data: { nested: "value" },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 1, data: { nested: "value" } });
    });

    it("should handle messages with topic parameter", async () => {
      const receivedTopics: string[] = [];
      const messages: string[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/string")
        async handleString(topic: string, message: string) {
          receivedTopics.push(topic);
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/string", "test");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedTopics).toHaveLength(1);
      expect(receivedTopics[0]).toBe("decorator/string");
      expect(messages[0]).toBe("test");
    });
  });

  describe("BaseMqtt Integration", () => {
    it("should provide logger instance to handlers", async () => {
      let loggerAvailable = false;

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          loggerAvailable = !!this.logger;
          this.logger.info("Test message");
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/test", { message: "test" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(loggerAvailable).toBe(true);
    });

    it("should create new instance for each message", async () => {
      const instances: any[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: { message: string }) {
          instances.push(this);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/test", { message: "msg1" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      await mqtt.publish("decorator/test", { message: "msg2" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(instances).toHaveLength(2);
    });
  });

  describe("Message Parsing", () => {
    it("should parse valid JSON to object", async () => {
      const messages: any[] = [];
      const types: string[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/test")
        async handleTest(message: any) {
          messages.push(message);
          types.push(typeof message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/test", { message: "parsed" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(types[0]).toBe("object");
      expect(messages[0]).toEqual({ message: "parsed" });
    });

    it("should keep strings as strings", async () => {
      const messages: any[] = [];
      const types: string[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/string")
        async handleString(message: any) {
          messages.push(message);
          types.push(typeof message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/string", "plain text");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(types[0]).toBe("string");
      expect(messages[0]).toBe("plain text");
    });

    it("should handle empty messages", async () => {
      const messages: any[] = [];

      class TestHandler extends BaseMqtt {
        @mqtt.subscribe("decorator/string")
        async handleString(message: any) {
          messages.push(message);
        }
      }

      await MqttService.connect(mqttConfig);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await mqtt.publish("decorator/string", "");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe("");
    });
  });
});
