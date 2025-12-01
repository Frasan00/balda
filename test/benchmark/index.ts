import { Server } from "../../src/server/server";
import { logger } from "../../src/logger/logger";

/**
 * Minimal server to benchmark the server performance
 */
const server = new Server({
  port: 80,
  host: "0.0.0.0",
  swagger: false,
});

server.get("/", (_req, res) => {
  res.json({ message: "Hello, world!" });
});

server.listen(({ port, host }) => {
  logger.info(`Benchmark server is listening on ${host}:${port}`);
});
