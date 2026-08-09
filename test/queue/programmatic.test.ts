import { describe, expect, it } from "vitest";
import { memoryQueue } from "../../src/queue/factories.js";

type TestPayload = { id: number; message: string };

// bun's `vitest`-compat layer doesn't implement vi.waitFor, and this file
// runs under both vitest and bun test — hand-rolled instead so it behaves
// identically everywhere.
const waitFor = async (
  predicate: () => boolean,
  { timeout = 10000, interval = 5 } = {},
): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

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
    // Delivery happens on a detached processing loop publish() doesn't await
    // — poll instead of a fixed sleep, which was flaky under full-suite CPU
    // contention (the event loop can fall behind a fixed 50ms budget).
    await waitFor(() => messages.length >= 1);
    expect(messages).toHaveLength(1);

    await handle.unsubscribe();

    await queue.publish({ id: 2, message: "second" });
    // Proving *no* message arrives has no event to poll for — a bounded
    // settle window is unavoidable here, widened for the same reason.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(messages).toHaveLength(1);
  }, 10000); // generous: shares one process-wide queue with the rest of the suite

  it("exposes subscribeMethod() as the decorator form", () => {
    const queue = memoryQueue<TestPayload>("handle-method");
    expect(typeof queue.subscribeMethod).toBe("function");

    const decorator = queue.subscribeMethod();
    expect(typeof decorator).toBe("function");
  });
});
