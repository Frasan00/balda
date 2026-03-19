import { describe, expect, it } from "vitest";
import { compression } from "../../src/plugins/compression/compression.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

describe("Compression Plugin", () => {
  it("should compress large JSON responses when gzip is supported", async () => {
    const middleware = compression({ threshold: 100, level: 6 });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip, deflate"]]),
      method: "GET",
    } as unknown as Request;

    let responseBody: any;
    let responseHeaders: Record<string, string> = {};

    const mockRes = {
      headers: {},
      send: function (body: any) {
        responseBody = body;
      },
      setHeader: function (key: string, value: string) {
        responseHeaders[key] = value;
        this.headers[key] = value;
      },
      json: function (body: any) {
        const jsonString = JSON.stringify(body);
        responseBody = jsonString;
      },
      text: function (body: string) {
        responseBody = body;
      },
    } as unknown as Response;

    const next = async () => {
      // Simulate a large JSON response
      const largeData = { data: "x".repeat(2000) };
      mockRes.json(largeData);
    };

    await middleware(mockReq, mockRes, next);

    expect(responseHeaders["Content-Encoding"]).toBe("gzip");
    expect(responseBody).toBeInstanceOf(Uint8Array);
  });

  it("should not compress when response is below threshold", async () => {
    const middleware = compression({ threshold: 10000, level: 6 });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip"]]),
      method: "GET",
    } as unknown as Request;

    let responseBody: any;
    const mockRes = {
      headers: {},
      send: function (body: any) {
        responseBody = body;
      },
      setHeader: function (key: string, value: string) {
        this.headers[key] = value;
      },
      json: function (body: any) {
        responseBody = JSON.stringify(body);
      },
      text: function (body: string) {
        responseBody = body;
      },
    } as unknown as Response;

    const next = async () => {
      mockRes.json({ data: "small" });
    };

    await middleware(mockReq, mockRes, next);

    expect(typeof responseBody).toBe("string");
    expect(responseBody).toContain("small");
  });

  it("should not compress when client doesn't support gzip", async () => {
    const middleware = compression({ threshold: 100, level: 6 });

    const mockReq = {
      rawHeaders: new Headers(),
      method: "GET",
    } as unknown as Request;

    let responseBody: any;
    const mockRes = {
      headers: {},
      send: function (body: any) {
        responseBody = body;
      },
      setHeader: function (key: string, value: string) {
        this.headers[key] = value;
      },
      json: function (body: any) {
        responseBody = JSON.stringify(body);
      },
      text: function (body: string) {
        responseBody = body;
      },
    } as unknown as Response;

    const next = async () => {
      mockRes.json({ data: "x".repeat(2000) });
    };

    await middleware(mockReq, mockRes, next);

    expect(typeof responseBody).toBe("string");
  });
});
