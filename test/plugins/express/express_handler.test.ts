import { describe, expect, it } from "vitest";
import { expressHandler } from "../../../src/plugins/express/express.js";
import type { Request } from "../../../src/server/http/request.js";
import type { Response } from "../../../src/server/http/response.js";

describe("Express Handler Conversion", () => {
  it("should convert handler that sends JSON response", async () => {
    let jsonBody: any;

    const handler = (req: any, res: any, next: any) => {
      res.json({ message: "success", data: [1, 2, 3] });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/api/data",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json(body: any) {
        jsonBody = body;
      },
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(jsonBody).toEqual({ message: "success", data: [1, 2, 3] });
  });

  it("should convert handler that sends text response", async () => {
    let textBody: any;

    const handler = (req: any, res: any, next: any) => {
      res.send("Hello, World!");
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/hello",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send(body: any) {
        textBody = body;
      },
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(textBody).toBe("Hello, World!");
  });

  it("should convert handler with custom status code", async () => {
    let statusValue = 0;
    let jsonBody: any;

    const handler = (req: any, res: any, next: any) => {
      res.status(201).json({ created: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/api/resource",
      method: "POST",
      headers: new Headers(),
      body: { name: "New Resource" },
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status(code: number) {
        statusValue = code;
        return this;
      },
      setHeader: () => mockRes,
      send: () => {},
      json(body: any) {
        jsonBody = body;
      },
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(statusValue).toBe(201);
    expect(jsonBody).toEqual({ created: true });
  });

  it("should handle async handlers", async () => {
    let asyncCompleted = false;
    let jsonBody: any;

    const handler = async (req: any, res: any, next: any) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncCompleted = true;
      res.json({ async: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/async",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json(body: any) {
        jsonBody = body;
      },
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(asyncCompleted).toBe(true);
    expect(jsonBody).toEqual({ async: true });
  });

  it("should handle handler that throws error", async () => {
    const testError = new Error("Handler error");
    let errorCaught = false;

    const handler = (req: any, res: any, next: any) => {
      throw testError;
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/error",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    try {
      await baldaHandler(mockReq, mockRes);
    } catch (error) {
      errorCaught = true;
      expect(error).toBe(testError);
    }

    expect(errorCaught).toBe(true);
  });

  it("should handle async handler that rejects", async () => {
    const testError = new Error("Async handler error");
    let errorCaught = false;

    const handler = async (req: any, res: any, next: any) => {
      await Promise.reject(testError);
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/async-error",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    try {
      await baldaHandler(mockReq, mockRes);
    } catch (error) {
      errorCaught = true;
      expect(error).toBe(testError);
    }

    expect(errorCaught).toBe(true);
  });

  it("should pass base path to request conversion", async () => {
    let capturedPath: string;
    let capturedBaseUrl: string;

    const handler = (req: any, res: any, next: any) => {
      capturedPath = req.path;
      capturedBaseUrl = req.baseUrl;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler, "/admin");

    const mockReq = {
      url: "http://localhost:3000/admin/dashboard",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    capturedPath ??= "";
    capturedBaseUrl ??= "";
    expect(capturedPath).toBe("/dashboard");
    expect(capturedBaseUrl).toBe("/admin");
  });

  it("should provide access to request body", async () => {
    let capturedBody: any;

    const handler = (req: any, res: any, next: any) => {
      capturedBody = req.body;
      res.json({ received: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/api/users",
      method: "POST",
      headers: new Headers([["content-type", "application/json"]]),
      body: { name: "John", email: "john@example.com" },
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(capturedBody).toEqual({ name: "John", email: "john@example.com" });
  });

  it("should provide access to query parameters", async () => {
    let capturedQuery: any;

    const handler = (req: any, res: any, next: any) => {
      capturedQuery = req.query;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/api/search?q=test&page=1",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: { q: "test", page: "1" },
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(capturedQuery).toEqual({ q: "test", page: "1" });
  });

  it("should provide access to route parameters", async () => {
    let capturedParams: any;

    const handler = (req: any, res: any, next: any) => {
      capturedParams = req.params;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/api/users/123",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: { id: "123" },
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(capturedParams).toEqual({ id: "123" });
  });

  it("should support setting headers", async () => {
    const headers: Record<string, string> = {};

    const handler = (req: any, res: any, next: any) => {
      res.setHeader("X-Custom-Header", "custom-value");
      res.set("X-Another", "another-value");
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers,
      responseStatus: 200,
      status: () => mockRes,
      setHeader(key: string, value: string) {
        headers[key] = value;
        return this;
      },
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(headers["X-Custom-Header"]).toBe("custom-value");
    expect(headers["X-Another"]).toBe("another-value");
  });

  it("should support redirect", async () => {
    let statusValue = 0;
    let locationHeader = "";

    const handler = (req: any, res: any, next: any) => {
      res.redirect(302, "/new-location");
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/old-location",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status(code: number) {
        statusValue = code;
        return this;
      },
      setHeader(key: string, value: string) {
        if (key === "Location") {
          locationHeader = value;
        }
        return this;
      },
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(statusValue).toBe(302);
    expect(locationHeader).toBe("/new-location");
  });

  it("should link req.res and res.req", async () => {
    let reqResLinked = false;
    let resReqLinked = false;

    const handler = (req: any, res: any, next: any) => {
      reqResLinked = req.res === res;
      resReqLinked = res.req === req;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(reqResLinked).toBe(true);
    expect(resReqLinked).toBe(true);
  });

  it("should handle sendStatus", async () => {
    let statusValue = 0;
    let sentBody: any;

    const handler = (req: any, res: any, next: any) => {
      res.sendStatus(404);
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/not-found",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status(code: number) {
        statusValue = code;
        return this;
      },
      setHeader: () => mockRes,
      send(body: any) {
        sentBody = body;
      },
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(statusValue).toBe(404);
    expect(sentBody).toBe("404");
  });

  it("should allow access to cookies", async () => {
    let capturedCookies: any;

    const handler = (req: any, res: any, next: any) => {
      capturedCookies = req.cookies;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
      cookies: { sessionId: "abc123", userId: "user1" },
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(capturedCookies).toEqual({ sessionId: "abc123", userId: "user1" });
  });

  it("should handle empty next function", async () => {
    let nextCalled = false;

    const handler = (req: any, res: any, next: any) => {
      next(); // Should not cause issues even though it's empty
      nextCalled = true;
      res.json({ ok: true });
    };

    const baldaHandler = expressHandler(handler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaHandler(mockReq, mockRes);

    expect(nextCalled).toBe(true);
  });
});
