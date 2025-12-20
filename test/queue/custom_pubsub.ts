import { GenericPubSub } from "../../src/queue/queue_types.js";

// Define payload type
type TestPayload = {
  name: string;
};

// Custom PubSub implementation
export class CustomPubSub implements GenericPubSub<TestPayload> {
  async publish(topic: string, payload: TestPayload): Promise<{ id: string }> {
    console.log("[CustomPubSub] Publishing to topic", topic, payload);
    return { id: "1" };
  }

  async subscribe(
    topic: string,
    handler: (payload: TestPayload) => Promise<void>,
  ) {
    console.log("[CustomPubSub] Subscribed to topic", topic);
    // Simulate receiving a message
    return Promise.resolve(handler({ name: "test" }));
  }
}
