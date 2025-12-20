import {
  bullmqQueue,
  createQueue,
  pgbossQueue,
  sqsQueue,
} from "../../src/index.js";
import { CustomPubSub } from "./custom_pubsub.js";

// Define payload types
type TestPayload = {
  name: string;
};

/**
 * Centralized queue registry - Best practice pattern
 * This provides a single source of truth for all queues in the application
 */
export const queues = {
  bullmq: bullmqQueue<TestPayload>("test"),
  sqs: sqsQueue<TestPayload>("test", {
    queueUrl: "http://localhost:9324/queue/balda-development-test",
  }),
  pgboss: pgbossQueue<TestPayload>("test"),
  custom: createQueue<TestPayload>("test", new CustomPubSub()),
} as const;
