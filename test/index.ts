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
    urlencoded: {
      extended: true,
    },
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
  (req, res) => {
    console.log(req.ip);
    res.text("Hello, world!");
  },
);

server.listen(({ port, host, url, logger }) => {
  swagger({ type: "standard" });
  logger.info(`Server is listening on ${url} on port ${port} on host ${host}`);
});
