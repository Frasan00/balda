import { Server } from "../../src/server/server";
import { logger } from "../../src/logger/logger";

/**
 * Minimal server to benchmark the server performance
 */
const server = new Server({
  swagger: false,
});

server.get("/", (_req, res) => {
  res.text("Hello, world!");
});

server.listen(({ port, host }) => {
  logger.info(`Benchmark server is listening on ${host}:${port}`);
});
