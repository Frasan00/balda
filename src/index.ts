export * from "./decorators/controller/controller";
export * from "./decorators/handlers/del";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/middleware/middleware";
export * from "./server/http/next";
export * from "./server/http/request";
export * from "./server/http/response";
export * from "./server/server";

import { controller } from "./decorators/controller/controller";
import { get } from "./decorators/handlers/get";
import { Request } from "./server/http/request";
import { Response } from "./server/http/response";

import { post } from "./decorators/handlers/post";
import { Server } from "./server/server";
import { middleware } from "src/decorators/middleware/middleware";

declare module "./server/server" {
  interface Server {
    test: () => void;
  }
}

(async () => {
  const server = new Server({
    plugins: {
      // cors: {
      //   origin: "*",
      // },
      // json: {
      //   sizeLimit: 1000,
      // },
    },
  });

  server.embed("test", () => {
    server.logger.info("test");
  });
  server.test();

  // server.use(async (req, res, next) => {
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
    @middleware(async (req, res, next) => {
      console.log("Post middleware");
      await next();
      console.log("Post middleware after");
    })
    async testPost(req: Request, res: Response) {
      const a = req.validate((Type) =>
        Type.Object({
          name: Type.String(),
          age: Type.Number(),
        }),
      );

      console.log(req.body);
      console.log(req.query);

      res.ok({
        test: "test",
      });
    }

    @get("/*")
    notFound(req: Request, res: Response) {
      console.log(req.params);
      res.json({
        message: "Not found daje",
      });
    }
  }

  server.listen(({ port, host, url, logger }) => {
    logger.info(
      `Server is listening on ${url} on port ${port} on host ${host}`,
    );
  });

  server.getRuntimeServer("bun");

  // await server.close();
  // console.log(server.isListening);
})();
