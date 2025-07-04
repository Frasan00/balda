import { Server } from "../../src/server/server";

/**
 * Minimal server to benchmark the server performance
 */
const server = new Server({
  controllerPatterns: ["../controllers/**/*.{ts,js}"],
  swagger: false,
});

server.get("/", (_req, res) => {
  res.text("Hello, world!");
});

server.listen(({ logger }) => {
  logger.info("Benchmark server is listening");
});
