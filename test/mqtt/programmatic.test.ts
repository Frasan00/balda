import { afterEach, describe, expect, it } from "vitest";
import { mqtt, MqttService } from "../../src/mqtt/mqtt.js";

declare module "../../src/mqtt/mqtt.types.js" {
  interface MqttTopics {
    "prog/temperature": { value: number };
    "prog/string": string;
  }
}

const mqttConfig = {
  host: process.env.MQTT_HOST || "localhost",
  port: Number(process.env.MQTT_PORT) || 1883,
  connectTimeout: 5000,
};

describe("mqtt programmatic subscribe", () => {
  afterEach(async () => {
    await MqttService.disconnect();
    MqttService.subscriptions = [];
  });

  it("returns a handle when subscribing with a callback", async () => {
    await MqttService.connect(mqttConfig);

    const handle = await mqtt.subscribe("prog/string", (message) => {
      void message;
    });

    expect(handle).toHaveProperty("topic", "prog/string");
    expect(typeof handle.unsubscribe).toBe("function");
  });

  it("receives published messages through a callback handler", async () => {
    await MqttService.connect(mqttConfig);

    const received: string[] = [];
    await mqtt.subscribe("prog/string", (message) => {
      received.push(message as string);
    });

    await mqtt.publish("prog/string", "hello");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toContain("hello");
  });

  it("unsubscribes via the returned handle", async () => {
    await MqttService.connect(mqttConfig);

    const received: string[] = [];
    const handle = await mqtt.subscribe("prog/string", (message) => {
      received.push(message as string);
    });

    await handle.unsubscribe();

    await mqtt.publish("prog/string", "ignored");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toHaveLength(0);
  });

  it("topic() factory publishes and receives typed messages", async () => {
    await MqttService.connect(mqttConfig);

    const sensor = mqtt.topic<{ value: number }>("prog/temperature");
    const received: number[] = [];

    await sensor.subscribe((msg) => {
      received.push(msg.value);
    });

    await sensor.publish({ value: 21 });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toContain(21);
    await sensor.unsubscribe();
  });
});
