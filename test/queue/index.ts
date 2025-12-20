import { defineQueueConfiguration, QueueService } from "../../src/index.js";
import { Server } from "../../src/server/server.js";
import { queues } from "./queues.js";

// Import handlers to register decorators
import "./schedules/bullmq.js";
import "./schedules/custom.js";
import "./schedules/pgboss.js";
import "./schedules/sqs.js";

// Configure queue providers
defineQueueConfiguration({
  bullmq: {
    connection: {
      host: "localhost",
      port: 6379,
      password: "root",
      db: 0,
    },
  },
  sqs: {
    client: {
      region: "us-east-1",
      endpoint: "http://localhost:9324",
    },
    consumer: {
      queueUrlMap: {
        test: "http://localhost:9324/000000000000/balda-development-test",
      },
    },
  },
  pgboss: {
    connectionString: "postgres://root:root@localhost:5432/database",
  },
});

// Start queue subscribers
await QueueService.run();

console.log("Queues started");

// Publish test messages using centralized queue registry
await queues.bullmq.publish({ name: "test" });
await queues.sqs.publish({ name: "test" });
await queues.pgboss.publish({ name: "test" });
await queues.custom.publish({ name: "test" });

// Optional: Start HTTP server if needed
const server = new Server({
  port: 3000,
  host: "0.0.0.0",
});

server.listen(() => {
  console.log("Server is listening on port 3000");
});
