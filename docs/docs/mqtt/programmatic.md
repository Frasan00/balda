---
title: MQTT Programmatic API
description: Subscribe to MQTT topics with callback handlers and a topic-scoped factory, without decorators.
keywords: [balda, mqtt, pubsub, messaging, programmatic, broker, iot]
sidebar_position: 2
---

# Programmatic API

You can subscribe to MQTT topics with plain callback functions instead of the `@mqtt.subscribe()` decorator. Both the bare `mqtt.subscribe(topic, handler)` form and the topic-scoped `mqtt.topic()` factory return a handle you can use to stop listening.

> **Prefer the programmatic API for new code.** The `@mqtt.subscribe()` decorator remains supported for class-based handlers with a scoped logger.

## Subscribe with a callback

```typescript
import { mqtt, MqttService } from "balda";

await MqttService.connect({ host: "localhost", port: 1883 });

const handle = await mqtt.subscribe("home/temperature", (message) => {
  console.log("Temperature:", message);
}, { qos: 1 });

// Later, stop listening
await handle.unsubscribe();
```

The handle exposes:

| Property       | Description                             |
| -------------- | --------------------------------------- |
| `topic`        | The topic this handle subscribes to.    |
| `unsubscribe()`| Stop listening on the topic.            |

## Topic-scoped factory

`mqtt.topic<T>()` creates a typed handle for a single topic with `subscribe`, `publish` and `unsubscribe`:

```typescript
import { mqtt, MqttService } from "balda";

await MqttService.connect({ host: "localhost", port: 1883 });

const sensor = mqtt.topic<{ value: number; unit: string }>("home/temperature");

await sensor.subscribe((message) => {
  console.log(`${message.value}${message.unit}`);
});

await sensor.publish({ value: 21, unit: "C" });

await sensor.unsubscribe();
```

## Handler signatures

Like the decorator, callback handlers can accept the message alone or include the topic (useful with wildcards):

```typescript
// single parameter — receives only the parsed message
mqtt.subscribe("home/temperature", (message) => {
  console.log(message);
});

// two parameters — receives (topic, message)
mqtt.subscribe("home/+/temperature", (topic, message) => {
  const room = topic.split("/")[1];
  console.log(`${room}:`, message);
});
```

Messages are auto-parsed Buffer → JSON → string, the same as the decorator form.

## Bootstrap with the Server

Wire MQTT subscriptions through the server `background` option so the client connects and subscribes on `listen()`:

```typescript
import { Server } from "balda";

const server = new Server({
  background: {
    mqtt: {
      connect: { host: "localhost", port: 1883 },
      subscribe: [
        {
          topic: "home/temperature",
          handler: (message) => console.log("Temperature:", message),
          options: { qos: 1 },
        },
      ],
    },
  },
});
```

This is an explicit alternative to `MqttService.massiveImportMqttHandlers()` + `MqttService.connect()`.
