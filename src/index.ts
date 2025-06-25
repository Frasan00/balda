export * from "./decorators/controller/controller";
export * from "./decorators/handlers/del";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/middleware/middleware";
export * from "./server/next";
export * from "./server/request";
export * from "./server/response";
export * from "./server/server";

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
      json: {
        sizeLimit: 1000,
      },
    },
  });

  server.embed("test", () => {
    console.log("test");
  });
  server.test();

  // server.useGlobalMiddleware(async (req, res, next) => {
  //   console.log("Global middleware");
  //   await next();
  //   console.log("Global middleware after");
  // });

  server.setErrorHandler(async (_req, res, _next, error) => {
    console.error(error);
    res.status(500).text("Error");
  });

  @controller()
  class TestController {
    @get("/hello-world")
    test(_req: Request, res: Response) {
      res.text("Hello, world!");
    }

    @get("/hard-to-find/:id")
    hardToFind(req: Request, res: Response) {
      console.log(req.params);
      res.json({
        message: "Hard to find!",
      });
    }

    @post("/post")
    async testPost(req: Request, res: Response) {
      console.log(req.body);
      console.log(req.query);
      res.ok({
        test: "test",
      });
    }

    @get("*")
    notFound(req: Request, res: Response) {
      console.log(req.params);
      res.json({
        message: "Not found",
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
