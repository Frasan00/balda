import { defineQueueConfiguration, QueueService } from "../../src/index.js";
import { publish } from "../../src/queue/pub.js";
import { Server } from "../../src/server/server.js";
import { CustomPubSub } from "./schedules/custom.js";

// Configure queue providers
defineQueueConfiguration({
  bullmq: {
    connection: {
      host: "127.0.0.1",
      password: "root",
      username: "default",
      db: 0,
    },
  },
  sqs: {
    client: { region: "us-east-1" },
    consumer: {
      queueUrlMap: {
        test: "http://localhost:9324/queue/balda-js-development-test",
      },
    },
  },
  pgboss: {
    connectionString: "postgres://root:root@localhost:5432/database",
  },
  custom: new CustomPubSub(),
});

// Import queue handlers from glob patterns
await QueueService.massiveImportQueues(["test/queue/schedules/**/*.ts"]);

// Start queue subscribers
await QueueService.run();

console.log("Queues started");

// Publish test messages
await publish.bullmq("test", { name: "test" });
await publish.sqs("test", { name: "test" });
await publish.pgboss("test", { name: "test" });
await publish("custom", "test", { name: "test" });

// Optional: Start HTTP server if needed
const server = new Server({
  port: 3000,
  host: "0.0.0.0",
});

server.listen(() => {
  console.log("Server is listening on port 3000");
});
