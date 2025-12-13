import { gzipSync } from "node:zlib";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import type { CompressionOptions } from "./compression_types";

const DEFAULT_THRESHOLD = 1024; // 1KB
const DEFAULT_LEVEL = 6;

// Default compressible content types
const DEFAULT_FILTER = [
  /text\/.+/,
  /application\/json/,
  /application\/javascript/,
  /application\/xml/,
  /application\/.*\+json/,
  /application\/.*\+xml/,
];

/**
 * Compression middleware for gzip compression of response bodies
 *
 * @param options Compression middleware options
 */
export const compression = (
  options?: CompressionOptions,
): ServerRouteMiddleware => {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const level = Math.max(0, Math.min(9, options?.level ?? DEFAULT_LEVEL));
  const filter = options?.filter ?? DEFAULT_FILTER;

  return async (req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = req.headers.get("accept-encoding") || "";
    const supportsGzip = acceptEncoding.includes("gzip");
    if (!supportsGzip) {
      return next();
    }

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalText = res.text.bind(res);

    const compressResponse = (body: any, contentType?: string): any => {
      if (!shouldCompress(body, contentType, threshold, filter)) {
        return body;
      }

      const buffer = getBodyBuffer(body);
      if (!buffer || buffer.length < threshold) {
        return body;
      }

      const compressed = gzipSync(buffer, { level });
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", compressed.length.toString());

      return compressed;
    };

    res.send = function (body: any): void {
      const contentType = res.headers["content-type"];
      const compressedBody = compressResponse(body, contentType);
      return originalSend(compressedBody);
    };

    res.json = function (body: any): void {
      const jsonString = JSON.stringify(body);
      const compressedBody = compressResponse(jsonString, "application/json");
      if (compressedBody !== jsonString) {
        res.setHeader("Content-Type", "application/json");
        return originalSend(compressedBody);
      }
      return originalJson(body);
    };

    res.text = function (body: string): void {
      const compressedBody = compressResponse(body, "text/plain");
      if (compressedBody !== body) {
        res.setHeader("Content-Type", "text/plain");
        return originalSend(compressedBody);
      }
      return originalText(body);
    };

    await next();
  };
};

const shouldCompress = (
  body: any,
  contentType: string | undefined,
  threshold: number,
  filter: RegExp[],
): boolean => {
  if (!body || !contentType) {
    return false;
  }

  const buffer = getBodyBuffer(body);
  if (!buffer || buffer.length < threshold) {
    return false;
  }

  return filter.some((pattern) => pattern.test(contentType));
};

const getBodyBuffer = (body: any): Buffer | null => {
  if (typeof body === "string") {
    return Buffer.from(body, "utf-8");
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "object") {
    return Buffer.from(JSON.stringify(body), "utf-8");
  }

  return null;
};
