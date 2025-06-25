export * from "./decorators/controller/controller";
export * from "./decorators/handlers/del";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/middleware/middleware";
export * from "./server/server";

import { cors } from "./plugins/cors/cors";
import { controller } from "./decorators/controller/controller";
import { get } from "./decorators/handlers/get";
import { middleware } from "./decorators/middleware/middleware";
import { Response } from "./server/response";
import { Request } from "./server/request";
import { Server } from "./server/server";
import { post } from "./decorators/handlers/post";

declare module "./server/server" {
  interface Server {
    test: () => void;
  }
}

(async () => {
  const server = new Server({
    plugins: {
      cors: {
        origin: "*",
      },
    },
  });

  server.embed("test", () => {
    console.log("test");
  });
  server.test();

  server.useGlobalMiddleware(async (req, res, next) => {
    console.log("Global middleware");
    await next();
    console.log("Global middleware after");
  });

  server.setErrorHandler(async (_req, res, _next, _error) => {
    console.log("Error handler");
    res.status(500).text("Error");
  });

  @controller()
  class TestController {
    @get("/test/:id")
    @middleware(async (_req, _res, next) => {
      console.log("Middleware before");
      await next();
      console.log("Middleware after");
    })
    test(req: Request, res: Response) {
      req.query;
      console.log(req.params);
      console.log("Handler");
      res.setHeader("X-Test", "test");
      console.log(res.responseHeaders);
      res.text("Hello, world!");
    }

    @post("/post")
    async testPost(req: Request, res: Response) {
      console.log(req.query);
      res.ok({
        test: "test",
      });
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
