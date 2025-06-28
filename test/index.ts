import { Type } from "@sinclair/typebox";
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

server.get(
  "/",
  {
    swagger: {
      service: "Test API",
      responses: {
        200: Type.String(),
      },
    },
  },
  (_req, res) => {
    res.text("Hello, world!");
  },
);

server.listen(({ port, host, url, logger }) => {
  server.use(
    swagger({
      title: "Test API",
      description: "Test API",
      version: "1.0.0",
      servers: ["http://localhost"],
    }),
  );
  logger.info(`Server is listening on ${url} on port ${port} on host ${host}`);
});
