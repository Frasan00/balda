import { describe, expect, it } from "vitest";
import { memoryQueue } from "../../src/queue/factories.js";

type TestPayload = { id: number; message: string };

describe("queue programmatic subscription handle", () => {
  it("returns a handle with id, topic and unsubscribe", async () => {
    const queue = memoryQueue<TestPayload>("handle-test");
    const handle = await queue.subscribe(async () => {});

    expect(handle).toHaveProperty("id");
    expect(handle).toHaveProperty("topic", "handle-test");
    expect(typeof handle.unsubscribe).toBe("function");
  });

  it("stops receiving messages after handle.unsubscribe()", async () => {
    const messages: TestPayload[] = [];
    const queue = memoryQueue<TestPayload>("handle-unsub");

    const handle = await queue.subscribe(async (payload) => {
      messages.push(payload);
    });

    await queue.publish({ id: 1, message: "first" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messages).toHaveLength(1);

    await handle.unsubscribe();

    await queue.publish({ id: 2, message: "second" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messages).toHaveLength(1);
  });

  it("exposes subscribeMethod() as the decorator form", () => {
    const queue = memoryQueue<TestPayload>("handle-method");
    expect(typeof queue.subscribeMethod).toBe("function");

    const decorator = queue.subscribeMethod();
    expect(typeof decorator).toBe("function");
  });
});
