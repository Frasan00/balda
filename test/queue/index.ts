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
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || "root",
      db: 0,
    },
  },
  sqs: {
    client: {
      region: process.env.SQS_REGION || "us-east-1",
      endpoint: process.env.SQS_ENDPOINT || "http://localhost:9324",
    },
    consumer: {
      queueUrlMap: {
        test: `${process.env.SQS_ENDPOINT || "http://localhost:9324"}/000000000000/balda-development-test`,
      },
    },
  },
  pgboss: {
    connectionString:
      process.env.POSTGRES_CONNECTION_STRING ||
      `postgres://${process.env.POSTGRES_USER || "root"}:${process.env.POSTGRES_PASSWORD || "root"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "database"}`,
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
