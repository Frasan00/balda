import { GenericPubSub } from "../../src/queue/queue_types.js";

// Define payload type
type TestPayload = {
  name: string;
};

// Custom PubSub implementation
export class CustomPubSub implements GenericPubSub<TestPayload> {
  private subscriptions: Map<string, (payload: TestPayload) => Promise<void>> =
    new Map();

  async publish(topic: string, payload: TestPayload): Promise<{ id: string }> {
    console.log("[CustomPubSub] Publishing to topic", topic, payload);
    return { id: "1" };
  }

  async subscribe(
    topic: string,
    handler: (payload: TestPayload) => Promise<void>,
  ): Promise<void> {
    console.log("[CustomPubSub] Subscribed to topic", topic);
    this.subscriptions.set(topic, handler);
    await handler({ name: "test" });
  }

  async unsubscribe(topic: string): Promise<void> {
    console.log("[CustomPubSub] Unsubscribed from topic", topic);
    this.subscriptions.delete(topic);
  }
}
