import { swagger } from "../src/plugins/swagger/swagger";
import { Server } from "../src/server/server";

const server = new Server({
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  logger: {
    level: "debug",
  },
  plugins: {
    static: "public",
  },
});

server.get("/", (_req, res) => {
  res.text("Hello, world!");
});

server.listen(({ port, host, url, logger }) => {
  server.use(swagger());
  logger.info(`Server is listening on ${url} on port ${port} on host ${host}`);
});
