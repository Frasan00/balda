import { defineQueueConfiguration } from "../../src/index.js";
import { publish } from "../../src/queue/pub.js";
import { Server } from "../../src/server/server.js";
import { CustomPubSub } from "./schedules/custom.js";
import "./schedules/custom.js";

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

const server = new Server({
  port: 3000,
  host: "0.0.0.0",
});

server.startRegisteredQueues(["test/queue/schedules/**/*.ts"], () =>
  console.log("Queues started"),
);

publish.bullmq("test", { name: "test" });
publish.sqs("test", { name: "test" });
publish.pgboss("test", { name: "test" });
publish("custom", "test", { name: "test" });

server.listen(() => {
  console.log("Server is listening on port 3000");
});
