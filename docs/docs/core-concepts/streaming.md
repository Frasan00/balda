---
title: Streaming Responses
description: Stream real-time data with async generators, SSE, and ReadableStream. Build AI chat, live feeds, and progressive loading.
keywords: [balda, streaming, sse, server-sent events, async generator]
sidebar_position: 6
---

# Streaming Responses

Balda provides built-in support for streaming responses, enabling real-time data delivery for use cases like Server-Sent Events (SSE), AI chat completions, live feeds, and progressive data loading.

## The `stream()` Method

The recommended way to stream responses is using the `stream()` method on the Response object. It accepts async generators, sync generators, or `ReadableStream` objects.

### Basic Usage with Async Generator

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

async function* generateData() {
  yield "data: First chunk\n\n";
  await new Promise((resolve) => setTimeout(resolve, 1000));
  yield "data: Second chunk\n\n";
  await new Promise((resolve) => setTimeout(resolve, 1000));
  yield "data: Third chunk\n\n";
}

server.get("/stream", async (req, res) => {
  res.stream(generateData());
});
```

The `stream()` method automatically sets the following headers for Server-Sent Events:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### Using Sync Generators

For simpler cases where you don't need async operations:

```typescript
function* generateChunks() {
  yield "data: Hello\n\n";
  yield "data: World\n\n";
  yield "data: Done\n\n";
}

server.get("/sync-stream", async (req, res) => {
  res.stream(generateChunks());
});
```

### Using ReadableStream

You can also pass a `ReadableStream` directly:

```typescript
function createStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue("data: First\n\n");
      controller.enqueue("data: Second\n\n");
      controller.enqueue("data: Third\n\n");
      controller.close(); // Important: close the stream when done
    },
  });
}

server.get("/readable-stream", async (req, res) => {
  res.stream(createStream());
});
```

:::warning
When using `ReadableStream`, always call `controller.close()` when finished. Failing to close the stream will cause the connection to hang indefinitely.
:::

### Custom Content Type

By default, `stream()` uses `text/event-stream`. You can override this:

```typescript
server.get("/custom-stream", async (req, res) => {
  res.stream(generateData(), { contentType: "text/plain" });
});
```

## Server-Sent Events (SSE) Format

For proper SSE implementation, format your data according to the SSE specification:

```typescript
async function* sseGenerator() {
  // Basic message
  yield "data: Hello World\n\n";

  // Message with event type
  yield 'event: update\ndata: {"status": "processing"}\n\n';

  // Message with ID (for reconnection)
  yield "id: 1\ndata: First event\n\n";

  // Multi-line data
  yield "data: Line 1\ndata: Line 2\n\n";
}
```

### SSE Event Structure

| Field    | Description                                        |
| -------- | -------------------------------------------------- |
| `data:`  | The message payload (required)                     |
| `event:` | Custom event type (optional, default is "message") |
| `id:`    | Event ID for client reconnection (optional)        |
| `retry:` | Reconnection time in milliseconds (optional)       |

Each message must end with `\n\n` (double newline).

## Real-World Example: AI Chat Streaming

```typescript
import { Server } from "balda";
import OpenAI from "openai";

const server = new Server({ port: 3000 });
const openai = new OpenAI();

async function* streamChatCompletion(messages: any[]) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4",
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield `data: ${JSON.stringify({ content })}\n\n`;
    }
  }

  yield "data: [DONE]\n\n";
}

server.router.post("/chat", async (req, res) => {
  const { messages } = req.body;
  res.stream(streamChatCompletion(messages));
});
```

## Low-Level: Using `nodeResponse` Directly

For advanced use cases requiring fine-grained control, you can access the underlying Node.js response object directly via `res.nodeResponse`.

:::note
This approach is only available when running on Node.js runtime. The `nodeResponse` property is `undefined` on other runtimes (Deno, Bun) that use Web API Response objects.
:::

```typescript
server.router.get("/node-stream", async (req, res) => {
  // Set headers manually
  res.nodeResponse.setHeader("Content-Type", "text/event-stream");
  res.nodeResponse.setHeader("Cache-Control", "no-cache");
  res.nodeResponse.setHeader("Connection", "keep-alive");
  res.nodeResponse.flushHeaders();

  try {
    for await (const chunk of generateData()) {
      res.nodeResponse.write(chunk);
    }
  } finally {
    res.nodeResponse.end();
  }
});
```

### When to Use `nodeResponse`

Use `nodeResponse` when you need:

- Custom write timing or batching
- Manual backpressure handling
- Integration with Node.js streams
- Direct access to Node.js response methods

## Client-Side Consumption

### JavaScript EventSource

```javascript
const eventSource = new EventSource("/stream");

eventSource.onmessage = (event) => {
  console.log("Received:", event.data);
};

eventSource.onerror = (error) => {
  console.error("Error:", error);
  eventSource.close();
};

// Custom event types
eventSource.addEventListener("update", (event) => {
  console.log("Update event:", event.data);
});
```

### Fetch API with ReadableStream

```javascript
async function consumeStream() {
  const response = await fetch("/stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    console.log("Chunk:", chunk);
  }
}
```

## Best Practices

### 1. Always Close Streams

```typescript
// ✅ Good: Stream closes when generator completes
async function* goodGenerator() {
  yield "data: start\n\n";
  yield "data: end\n\n";
  // Generator naturally completes
}

// ✅ Good: Explicit close for ReadableStream
new ReadableStream({
  start(controller) {
    controller.enqueue("data: hello\n\n");
    controller.close(); // Don't forget this!
  },
});
```

### 2. Handle Errors Gracefully

```typescript
async function* safeGenerator() {
  try {
    yield "data: starting\n\n";

    const data = await fetchData();
    yield `data: ${JSON.stringify(data)}\n\n`;
  } catch (error) {
    yield `data: ${JSON.stringify({ error: "Failed to fetch data" })}\n\n`;
  }
}
```

### 3. Consider Connection Timeouts

For long-running streams, send periodic heartbeats to prevent proxy timeouts:

```typescript
async function* withHeartbeat() {
  const heartbeatInterval = setInterval(() => {
    // Comment lines are ignored by EventSource
  }, 15000);

  try {
    yield ": heartbeat\n\n"; // SSE comment for keepalive

    for await (const data of dataSource) {
      yield `data: ${JSON.stringify(data)}\n\n`;
    }
  } finally {
    clearInterval(heartbeatInterval);
  }
}
```

### 4. Use Appropriate Content Types

| Use Case                | Content Type                  |
| ----------------------- | ----------------------------- |
| Server-Sent Events      | `text/event-stream` (default) |
| Plain text streaming    | `text/plain`                  |
| JSON streaming (NDJSON) | `application/x-ndjson`        |
| Binary data             | `application/octet-stream`    |

## Summary

| Approach                     | Use Case                       | Cross-Runtime   |
| ---------------------------- | ------------------------------ | --------------- |
| `res.stream(generator)`      | Most streaming scenarios       | ✅ Yes          |
| `res.stream(ReadableStream)` | When you have a ReadableStream | ✅ Yes          |
| `res.nodeResponse`           | Low-level Node.js control      | ❌ Node.js only |

The `stream()` method is the recommended approach for most use cases as it provides a clean API and works across all supported runtimes.
