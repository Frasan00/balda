---
title: MQTT Overview
description: Decorator-based MQTT client for pub/sub messaging. Subscribe to topics with type-safe handlers.
keywords: [balda, mqtt, pubsub, messaging, broker, iot]
sidebar_position: 1
---

# MQTT Overview

Balda provides a **decorator-based MQTT client** that lets you subscribe to MQTT topics and publish messages with full type safety. This feature is available in **Node.js compatible environments**.

:::tip Prefer the programmatic API for new code
The [Programmatic API](./programmatic) subscribes with plain callback handlers (or a typed `mqtt.topic()` factory) without decorators or glob imports.
:::

> **Peer dependency** — Balda uses the community-standard [`mqtt`](https://www.npmjs.com/package/mqtt) package. To enable MQTT support you must install it yourself:
>
> ```bash
> # with npm
> npm install mqtt
>
> # or with yarn / pnpm / bun
> yarn add mqtt
> pnpm add mqtt
> bun add mqtt
> ```

## Quick Start

### 1. Define Your Topics (Type Safety)

Declare your MQTT topics once via module augmentation:

```typescript
declare module "balda" {
  interface MqttTopics {
    "home/temperature": { value: number; unit: string };
    "home/humidity": { value: number };
    "sensors/status": string;
  }
}
```

### 2. Create Handlers with Decorators

```typescript
import { BaseMqtt, mqtt } from "balda";

export default class extends BaseMqtt {
  @mqtt.subscribe("home/temperature")
  async handleTemperature(message: { value: number; unit: string }) {
    this.logger.info(`Temperature: ${message.value}${message.unit}`);

    // Publish response
    await mqtt.publish("home/ack", { received: true }, { qos: 1 });
  }
}
```

### 3. Connect to MQTT Broker

```typescript
import { MqttService, setMqttGlobalErrorHandler } from "balda";

// Optional: Set global error handler
setMqttGlobalErrorHandler((error: Error) => {
  console.error("MQTT Error:", error);
});

// Import handlers
await MqttService.massiveImportMqttHandlers(["src/mqtt/**/*.ts"]);

// Connect to MQTT broker and subscribe to all registered topics
await MqttService.connect({
  host: "localhost",
  port: 1883,
  protocol: "mqtt",
  username: "user",
  password: "pass",
});

console.log("MQTT connected");
```

## Key Features

- **🎯 Type-safe**: Full TypeScript support with topic and message typing
- **🔄 Auto-parsing**: Messages automatically parsed from Buffer → JSON → string
- **🎨 Decorator-based**: Clean, intuitive API with `@mqtt.subscribe()`
- **📤 Easy publishing**: Simple `mqtt.publish()` for sending messages
- **🔌 Wildcard support**: Subscribe to multiple topics with `+` and `#`
- **⚡ QoS levels**: Full support for QoS 0, 1, and 2
- **🛡️ Error handling**: Built-in error handlers with custom override support

## Message Parsing

Messages are automatically parsed in this order:

1. **JSON object** → If valid JSON, returns parsed object
2. **String** → If not JSON, returns as string
3. **Buffer** → Fallback to original Buffer

```typescript
@mqtt.subscribe('sensor/data')
handleData(message: { temp: number } | string) {
  // message is automatically parsed based on content
  if (typeof message === 'object') {
    console.log('JSON:', message.temp);
  } else {
    console.log('String:', message);
  }
}
```

## MQTT Wildcards

Subscribe to multiple topics using MQTT wildcards:

### Single-level wildcard (+)

Matches exactly one level:

```typescript
@mqtt.subscribe('home/+/temperature')
handleRoomTemp(topic: string, message: string) {
  const room = topic.split('/')[1]; // bedroom, kitchen, etc.
  console.log(`${room}: ${message}`);
}
```

### Multi-level wildcard (#)

Matches any number of levels:

```typescript
@mqtt.subscribe('sensors/#')
handleAllSensors(topic: string, message: string) {
  // Matches: sensors/temp, sensors/room/temp, etc.
  console.log(`Sensor ${topic}: ${message}`);
}
```

## Handler Signatures

Handlers can accept parameters in two ways:

### Without topic parameter (recommended)

```typescript
@mqtt.subscribe('home/temperature')
handleTemperature(message: { value: number; unit: string }) {
  // Topic is already known from decorator
}
```

### With topic parameter (useful for wildcards)

```typescript
@mqtt.subscribe('home/+/temperature')
handleRoomTemperature(topic: string, message: string) {
  // Topic is included for dynamic routing
}
```

## CLI Generator

Generate MQTT handlers using the CLI:

```bash
npx balda generate-mqtt -t home/temperature -p src/mqtt
```

This creates a handler file with proper boilerplate:

```typescript
import { BaseMqtt, mqtt } from "balda";

declare module "balda" {
  interface MqttTopics {
    "home/temperature": string;
  }
}

export default class extends BaseMqtt {
  @mqtt.subscribe("home/temperature")
  async handle(message: string) {
    this.logger.info({ message }, "Message received");
    // Implement your MQTT handler logic here
  }
}
```

## Error Handling

Set a custom global error handler for MQTT operations:

```typescript
import { setMqttGlobalErrorHandler } from "balda";

setMqttGlobalErrorHandler((error: Error) => {
  console.error("MQTT Error:", error);
  // Send to Sentry, log to file, etc.
});
```

Errors within handlers are automatically caught and logged:

```typescript
@mqtt.subscribe('sensor/data')
async handleSensorData(message: string) {
  try {
    const data = JSON.parse(message);
    // Process data
  } catch (error) {
    this.logger.error('Failed to parse', error);
    throw error; // Caught by global handler
  }
}
```

## Logger

The `BaseMqtt` class provides a scoped logger:

```typescript
export default class extends BaseMqtt {
  @mqtt.subscribe("test/topic")
  async handle(message: string) {
    this.logger.info("Message received");
    this.logger.debug("Raw message:", message);
    this.logger.error("Something went wrong");
  }
}
```

## Connection Options

All MQTT.js connection options are supported:

```typescript
import { MqttService } from "balda";

await MqttService.connect({
  host: "localhost",
  port: 1883,
  protocol: "mqtt", // or 'mqtts', 'ws', 'wss'
  username: "user",
  password: "pass",
  clientId: "my-client",
  keepalive: 60,
  clean: true,
  reconnectPeriod: 1000,
  connectTimeout: 30000,
  will: {
    topic: "status/offline",
    payload: "Device disconnected",
    qos: 1,
    retain: true,
  },
});
```

## Manual Import

You can manually import handlers instead of using patterns:

```typescript
import { MqttService } from "balda";
import "./handlers/temperature.js";
import "./handlers/humidity.js";

await MqttService.connect({
  host: "localhost",
  port: 1883,
});
```

## Disconnecting

The MQTT client automatically handles reconnection. To manually disconnect:

```typescript
import { MqttService } from "balda";

await MqttService.disconnect();
```

## Additional Resources

For more information about MQTT and the underlying library, see the [mqtt.js documentation](https://www.npmjs.com/package/mqtt).
