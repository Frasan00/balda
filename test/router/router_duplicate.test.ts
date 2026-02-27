import { describe, it, expect, beforeEach } from "vitest";
import { Router } from "../../src/server/router/router.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

describe("Router - Duplicate Route Detection", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should throw when registering the same method and path twice", () => {
    const handler1 = (req: Request, res: Response) => {};
    const handler2 = (req: Request, res: Response) => {};

    router.get("/users", handler1);

    expect(() => router.get("/users", handler2)).toThrow(
      "Duplicate route detected: GET /users is already registered. Each route must be unique.",
    );
  });

  it("should allow different methods on the same path", () => {
    const getHandler = (req: Request, res: Response) => {};
    const postHandler = (req: Request, res: Response) => {};

    router.get("/users", getHandler);

    expect(() => router.post("/users", postHandler)).not.toThrow();
  });

  it("should throw for duplicate dynamic routes", () => {
    const handler1 = (req: Request, res: Response) => {};
    const handler2 = (req: Request, res: Response) => {};

    router.get("/users/:id", handler1);

    expect(() => router.get("/users/:id", handler2)).toThrow(
      "Duplicate route detected",
    );
  });

  it("should not throw when applyGlobalMiddlewaresToAllRoutes re-registers routes", () => {
    const handler = (req: Request, res: Response) => {};
    const globalMiddleware = (req: Request, res: Response, next: () => void) =>
      next();

    router.get("/users", handler);
    router.post("/users", handler);

    expect(() =>
      router.applyGlobalMiddlewaresToAllRoutes([globalMiddleware]),
    ).not.toThrow();
  });

  it("should throw for duplicate routes registered via group", () => {
    const handler1 = (req: Request, res: Response) => {};
    const handler2 = (req: Request, res: Response) => {};

    router.get("/api/users", handler1);

    expect(() => {
      router.group("/api", (child) => {
        child.get("/users", handler2);
      });
    }).toThrow("Duplicate route detected");
  });
});
