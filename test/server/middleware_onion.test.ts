import { describe, expect, it } from "vitest";
import { executeMiddlewareChain } from "../../src/runtime/native_server/server_utils.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { ServerRouteMiddleware } from "../../src/index.js";

describe("Middleware Onion Model", () => {
  it("should execute middleware in onion pattern (before -> handler -> after)", async () => {
    const execution: string[] = [];

    const middleware1 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 1");
      await next();
      execution.push("after 1");
    };

    const middleware2 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 2");
      await next();
      execution.push("after 2");
    };

    const middleware3 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 3");
      await next();
      execution.push("after 3");
    };

    const handler = async (req: Request, res: Response) => {
      execution.push("handler");
      res.send("ok");
    };

    const req = new Request();
    const res = new Response();

    await executeMiddlewareChain(
      [
        middleware1 as ServerRouteMiddleware,
        middleware2 as ServerRouteMiddleware,
        middleware3 as ServerRouteMiddleware,
      ],
      handler,
      req,
      res,
    );

    // Should follow onion pattern: outer middleware wraps inner middleware
    expect(execution).toEqual([
      "before 1",
      "before 2",
      "before 3",
      "handler",
      "after 3",
      "after 2",
      "after 1",
    ]);
  });

  it("should stop chain when middleware doesn't call next", async () => {
    const execution: string[] = [];

    const middleware1 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 1");
      await next();
      execution.push("after 1");
    };

    const middleware2 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("middleware 2 - blocking");
      // Don't call next() - chain stops here
      res.send("blocked");
    };

    const middleware3 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 3");
      await next();
      execution.push("after 3");
    };

    const handler = async (req: Request, res: Response) => {
      execution.push("handler");
      res.send("ok");
    };

    const req = new Request();
    const res = new Response();

    await executeMiddlewareChain(
      [
        middleware1 as ServerRouteMiddleware,
        middleware2 as ServerRouteMiddleware,
        middleware3 as ServerRouteMiddleware,
      ],
      handler,
      req,
      res,
    );

    // Should execute before 1, middleware 2 blocks, then after 1 unwinds
    expect(execution).toEqual([
      "before 1",
      "middleware 2 - blocking",
      "after 1",
    ]);

    // Handler should never execute
    expect(execution).not.toContain("handler");
    expect(execution).not.toContain("before 3");
  });

  it("should handle async operations in middleware correctly", async () => {
    const execution: string[] = [];

    const middleware1 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      await next();
      await new Promise((resolve) => setTimeout(resolve, 10));
      execution.push("after 1");
    };

    const middleware2 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      execution.push("before 2");
      await next();
      execution.push("after 2");
    };

    const handler = async (req: Request, res: Response) => {
      execution.push("handler");
      res.send("ok");
    };

    const req = new Request();
    const res = new Response();

    await executeMiddlewareChain(
      [
        middleware1 as ServerRouteMiddleware,
        middleware2 as ServerRouteMiddleware,
      ],
      handler,
      req,
      res,
    );

    expect(execution).toEqual([
      "before 1",
      "before 2",
      "handler",
      "after 2",
      "after 1",
    ]);
  });

  it("should allow middleware to modify request/response throughout chain", async () => {
    const req = new Request();
    const res = new Response();

    // Use any to test dynamic properties
    const reqAny = req as any;

    const middleware1 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      (req as any).step1 = "added";
      await next();
      (req as any).step1 += "-modified";
    };

    const middleware2 = async (
      req: Request,
      res: Response,
      next: () => Promise<void>,
    ) => {
      (req as any).step2 = (req as any).step1 + "-step2";
      await next();
    };

    const handler = async (req: Request, res: Response) => {
      (req as any).handler = "done";
      res.send("ok");
    };

    await executeMiddlewareChain(
      [
        middleware1 as ServerRouteMiddleware,
        middleware2 as ServerRouteMiddleware,
      ],
      handler,
      req,
      res,
    );

    expect(reqAny.step1).toBe("added-modified");
    expect(reqAny.step2).toBe("added-step2");
    expect(reqAny.handler).toBe("done");
  });
});
