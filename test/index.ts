import { controller, get } from "../src";
import { Request } from "../src/server/http/request";
import { Response } from "../src/server/http/response";
import { Server } from "../src/server/server";
import { WebSocketServer } from "ws";

@controller()
class TestController {
  @get("/hello-world")
  test(_req: Request, res: Response) {
    res.text("Hello, world!");
  }
}

(async () => {
  const server = new Server();

  const httpServer = server.getNodeServer();
  console.log(httpServer);
  const wss = new WebSocketServer({ server: httpServer });

  server.listen(({ port, host, url, logger }) => {
    logger.info(
      `Server is listening on ${url} on port ${port} on host ${host}`
    );
  });
})();
