import { describe, expect, it } from "vitest";
import { compression } from "../../src/plugins/compression/compression.js";
import { Response } from "../../src/server/http/response.js";
import type { Request } from "../../src/server/http/request.js";

describe("Compression Plugin", () => {
  it("should compress large JSON responses when gzip is supported", async () => {
    const middleware = compression({ threshold: 100, level: 6 });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip, deflate"]]),
      method: "GET",
    } as unknown as Request;

    const res = new Response();
    await middleware(mockReq, res, async () => {
      res.json({ data: "x".repeat(2000) });
    });

    expect(res.headers["Content-Encoding"]).toBe("gzip");
    expect(res.headers["Vary"]).toBe("Accept-Encoding");
    const body = res.getBody();
    expect(body).toBeInstanceOf(Uint8Array);
  });

  it("should not compress when response is below threshold", async () => {
    const middleware = compression({ threshold: 10000, level: 6 });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip"]]),
      method: "GET",
    } as unknown as Request;

    const res = new Response();
    await middleware(mockReq, res, async () => {
      res.json({ data: "small" });
    });

    expect(res.headers["Content-Encoding"]).toBeUndefined();
    expect(res.headers["Vary"]).toBe("Accept-Encoding");
  });

  it("should not compress when client doesn't support gzip", async () => {
    const middleware = compression({ threshold: 100, level: 6 });

    const mockReq = {
      rawHeaders: new Headers(),
      method: "GET",
    } as unknown as Request;

    const res = new Response();
    await middleware(mockReq, res, async () => {
      res.json({ data: "x".repeat(2000) });
    });

    expect(res.headers["Content-Encoding"]).toBeUndefined();
    expect(res.headers["Vary"]).toBe("Accept-Encoding");
  });

  it("should not compress when gzip is rejected via q=0", async () => {
    const middleware = compression({ threshold: 100, level: 6 });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip;q=0, deflate"]]),
      method: "GET",
    } as unknown as Request;

    const res = new Response();
    await middleware(mockReq, res, async () => {
      res.json({ data: "x".repeat(2000) });
    });

    expect(res.headers["Content-Encoding"]).toBeUndefined();
  });

  it("should skip compression when skipFor predicate returns true", async () => {
    const middleware = compression({
      threshold: 100,
      skipFor: () => true,
    });

    const mockReq = {
      rawHeaders: new Headers([["accept-encoding", "gzip"]]),
      method: "GET",
    } as unknown as Request;

    const res = new Response();
    await middleware(mockReq, res, async () => {
      res.json({ data: "x".repeat(2000) });
    });

    expect(res.headers["Content-Encoding"]).toBeUndefined();
  });
});
