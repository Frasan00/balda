import { swagger } from "../src/plugins/swagger/swagger";
import { Server } from "../src/server/server";

(async () => {
  const server = new Server({
    controllerPatterns: ["./test/controllers/*.{ts,js}"],
    logger: {
      level: "debug",
    },
  });

  server.get("/hello-world", (_req, res) => {
    res.text("Hello, world!");
  });

  server.listen(({ port, host, url, logger }) => {
    logger.info(
      `Server is listening on ${url} on port ${port} on host ${host}`
    );
  });

  server.use(swagger());
})();
