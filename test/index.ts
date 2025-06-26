import { Type } from "@sinclair/typebox";
import { controller, get } from "src/index";
import { swagger } from "src/plugins/swagger/swagger";
import { Request } from "src/server/http/request";
import { Response } from "src/server/http/response";
import { Server } from "../src/server/server";

@controller()
class TestController {
  @get("/test", {
    service: "test-service",
    description: "Test route",
    requestBody: Type.Object({
      name: Type.String(),
      object: Type.Object({
        name: Type.String(),
      }),
    }),
    security: [
      "bearer"
    ],
    responses: {
      201: Type.Object({
        message: Type.String(),
      }),
    },
  })
  test(_req: Request, res: Response) {
    res.text("Hello, world!");
  }
}

(async () => {
  const server = new Server();

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
