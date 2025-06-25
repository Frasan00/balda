export * from "./decorators/controller/controller";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/del";
export * from "./decorators/middleware/middleware";
export * from "./server/server";

import { controller } from "./decorators/controller/controller";
import { get } from "./decorators/handlers/get";
import { middleware } from "./decorators/middleware/middleware";
import { Response } from "./server/response";
import { Server } from "./server/server";

declare module "./server/server" {
  interface Server {
    test: () => void;
  }
}

(async () => {
  const server = new Server();
  server.embed("test", () => {
    console.log("test");
  });
  server.test();

  server.globalMiddleware(async (req, res, next) => {
    console.log("Global middleware");
    await next();
    console.log("Global middleware after");
  });

  server.setErrorHandler(async (_req, res, _next, _error) => {
    console.log("Error handler");
    res.status(500).text("Error");
  });

  server.defineMiddleware("test", async (_req, _res, next) => {
    console.log("Test middleware");
    await next();
    console.log("Test middleware after");
  });

  @controller("/v1")
  class TestController {
    @get("/test")
    @middleware(async (_req, _res, next) => {
      console.log("Middleware before");
      await next();
      console.log("Middleware after");
    })
    test(req: Request, res: Response) {
      console.log("Handler");
      res.setHeader("X-Test", "test");
      res.text("Hello, world!");
    }
  }

  server.listen(({ port, host, url }) => {
    console.log(
      `Server is listening on ${url} on port ${port} on host ${host}`
    );
  });

  // await server.close();
  // console.log(server.isListening);
})();
