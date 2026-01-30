import { describe, expect, it } from "vitest";
import { expressMiddleware } from "../../../src/plugins/express/express.js";
import type { Request } from "../../../src/server/http/request.js";
import type { Response } from "../../../src/server/http/response.js";

describe("Express Request Conversion", () => {
  it("should convert basic request properties", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/api/users?page=1",
      method: "POST",
      headers: new Headers([["content-type", "application/json"]]),
      body: { name: "John" },
      query: { page: "1" },
      params: { id: "123" },
      cookies: { sessionId: "abc" },
      session: { userId: "user1" },
      ip: "127.0.0.1",
      files: [],
      file: () => null,
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.body).toEqual({ name: "John" });
    expect(capturedExpressReq.query).toEqual({ page: "1" });
    expect(capturedExpressReq.params).toEqual({ id: "123" });
    expect(capturedExpressReq.cookies).toEqual({ sessionId: "abc" });
    expect(capturedExpressReq.session).toEqual({ userId: "user1" });
    expect(capturedExpressReq.method).toBe("POST");
    expect(capturedExpressReq.ip).toBe("127.0.0.1");
  });

  it("should extract URL properties correctly", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler, "/api");

    const mockReq = {
      url: "http://localhost:3000/api/users?search=test",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: { search: "test" },
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.originalUrl).toBe("/api/users?search=test");
    expect(capturedExpressReq.baseUrl).toBe("/api");
    expect(capturedExpressReq.path).toBe("/users");
    expect(capturedExpressReq.url).toBe("/api/users");
    expect(capturedExpressReq.protocol).toBe("http");
    expect(capturedExpressReq.hostname).toBe("localhost");
    expect(capturedExpressReq.host).toBe("localhost:3000");
    expect(capturedExpressReq.secure).toBe(false);
  });

  it("should handle HTTPS protocol correctly", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "https://example.com/secure",
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.protocol).toBe("https");
    expect(capturedExpressReq.secure).toBe(true);
  });

  it("should respect x-forwarded-proto header", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers([["x-forwarded-proto", "https"]]),
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.protocol).toBe("https");
    expect(capturedExpressReq.secure).toBe(true);
  });

  it("should implement get() and header() methods", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers([
        ["content-type", "application/json"],
        ["authorization", "Bearer token123"],
      ]),
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.get("content-type")).toBe("application/json");
    expect(capturedExpressReq.get("Content-Type")).toBe("application/json");
    expect(capturedExpressReq.header("Authorization")).toBe("Bearer token123");
    expect(capturedExpressReq.get("non-existent")).toBeUndefined();
  });

  it("should detect XHR requests", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers([["x-requested-with", "XMLHttpRequest"]]),
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.xhr).toBe(true);
  });

  it("should set xhr to false when not XMLHttpRequest", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.xhr).toBe(false);
  });

  it("should implement param() method with params fallback", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/users/123",
      method: "GET",
      headers: new Headers(),
      body: {},
      query: { page: "1" },
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.param("id")).toBe("123");
    expect(capturedExpressReq.param("page")).toBe("1");
    expect(capturedExpressReq.param("nonexistent")).toBeUndefined();
  });

  it("should handle files from multipart form data", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockFiles = [
      { formName: "avatar", filename: "profile.jpg", size: 1024 },
      { formName: "document", filename: "doc.pdf", size: 2048 },
    ];

    const mockReq = {
      url: "http://localhost:3000/upload",
      method: "POST",
      headers: new Headers([["content-type", "multipart/form-data"]]),
      body: {},
      query: {},
      params: {},
      files: mockFiles,
      file: (fieldName: string) =>
        mockFiles.find((f) => f.formName === fieldName) ?? null,
    } as unknown as Request;

    const mockRes = {
      headers: {},
      responseStatus: 200,
      status: () => mockRes,
      setHeader: () => mockRes,
      send: () => {},
      json: () => {},
    } as unknown as Response;

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.files).toEqual(mockFiles);
    expect(capturedExpressReq.file).toBeDefined();
  });

  it("should handle empty base path", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler, "");

    const mockReq = {
      url: "http://localhost:3000/users",
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.baseUrl).toBe("");
    expect(capturedExpressReq.path).toBe("/users");
  });

  it("should set fresh and stale properties", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.fresh).toBe(false);
    expect(capturedExpressReq.stale).toBe(true);
  });

  it("should provide access to headers object", async () => {
    let capturedExpressReq: any;

    const expressHandler = (req: any, res: any, next: any) => {
      capturedExpressReq = req;
      next();
    };

    const baldaMiddleware = expressMiddleware(expressHandler);

    const mockReq = {
      url: "http://localhost:3000/test",
      method: "GET",
      headers: new Headers([
        ["host", "localhost:3000"],
        ["user-agent", "test-agent"],
      ]),
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

    await baldaMiddleware(mockReq, mockRes, async () => {});

    expect(capturedExpressReq.headers).toBeDefined();
    expect(capturedExpressReq.headers.host).toBe("localhost:3000");
    expect(capturedExpressReq.headers["user-agent"]).toBe("test-agent");
  });
});
