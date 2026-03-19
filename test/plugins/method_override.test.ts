import { describe, expect, it } from "vitest";
import { methodOverride } from "../../src/plugins/method_override/method_override.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

describe("Method Override Plugin", () => {
  it("should override POST to DELETE via header", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    });

    const mockReq = {
      method: "POST",
      rawHeaders: new Headers([["X-HTTP-Method-Override", "DELETE"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("DELETE");
  });

  it("should override POST to PUT via header", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    });

    const mockReq = {
      method: "POST",
      rawHeaders: new Headers([["X-HTTP-Method-Override", "PUT"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("PUT");
  });

  it("should not override GET requests by default", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    });

    const mockReq = {
      method: "GET",
      rawHeaders: new Headers([["X-HTTP-Method-Override", "DELETE"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("GET");
  });

  it("should handle case-insensitive method names", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    });

    const mockReq = {
      method: "post",
      rawHeaders: new Headers([["X-HTTP-Method-Override", "delete"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("DELETE");
  });

  it("should not override with invalid method", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    });

    const mockReq = {
      method: "POST",
      rawHeaders: new Headers([["X-HTTP-Method-Override", "INVALID"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("POST");
  });

  it("should work with custom header name", async () => {
    const middleware = methodOverride({
      methods: ["POST"],
      header: "X-HTTP-Method",
    });

    const mockReq = {
      method: "POST",
      rawHeaders: new Headers([["X-HTTP-Method", "PATCH"]]),
    } as unknown as Request;

    const mockRes = {} as Response;
    const next = async () => {};

    await middleware(mockReq, mockRes, next);

    expect(mockReq.method).toBe("PATCH");
  });
});
