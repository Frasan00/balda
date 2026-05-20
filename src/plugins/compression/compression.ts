import { gzip as gzipCb } from "node:zlib";
import { promisify } from "node:util";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import type { CompressionOptions } from "./compression_types.js";

const gzip = promisify(gzipCb);

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
 * Compression middleware for gzip compression of response bodies.
 *
 * Uses async gzip to avoid blocking the event loop on large payloads.
 * Always emits `Vary: Accept-Encoding` to prevent cache poisoning.
 *
 * BREACH/CRIME note: if an endpoint reflects user-controlled data in a compressed
 * response, use `skipFor` to opt that route out of compression.
 *
 * @param options Compression middleware options
 */
export const compression = (
  options?: CompressionOptions,
): ServerRouteMiddleware => {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const level = Math.max(0, Math.min(9, options?.level ?? DEFAULT_LEVEL));
  const filter = options?.filter ?? DEFAULT_FILTER;
  const skipFor = options?.skipFor;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Always add Vary so caches don't serve compressed responses to clients that
    // didn't send Accept-Encoding: gzip
    res.setHeader("Vary", "Accept-Encoding");

    const acceptEncoding = req.rawHeaders.get("accept-encoding") || "";
    if (!acceptsGzip(acceptEncoding)) {
      return next();
    }

    await next();

    // After the handler chain runs, check skipFor predicate
    if (skipFor?.(req, res)) {
      return;
    }

    // getBody() runs lazy serialization (fast-json-stringify) and returns the body
    const body = res.getBody();
    if (body == null) {
      return;
    }

    const contentType = res.headers["Content-Type"];
    if (!contentType || !filter.some((p) => p.test(contentType))) {
      return;
    }

    const buffer = getBodyBuffer(body);
    if (!buffer || buffer.length < threshold) {
      return;
    }

    const compressed = await gzip(buffer, { level });
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", compressed.length.toString());
    // Replace the body with the compressed buffer; clears the lazy serializer
    res.setBodyDirect(compressed);
  };
};

/**
 * Returns true if the Accept-Encoding header expresses a non-zero preference for gzip.
 * Handles q-values: `gzip;q=0` means the client explicitly rejects gzip.
 */
function acceptsGzip(acceptEncoding: string): boolean {
  for (const part of acceptEncoding.split(",")) {
    const [enc, ...params] = part.trim().split(";");
    if (enc.trim().toLowerCase() !== "gzip") continue;
    const qParam = params.find((p) => p.trim().startsWith("q="));
    if (qParam) {
      const q = parseFloat(qParam.trim().slice(2));
      return !Number.isNaN(q) && q > 0;
    }
    return true; // no q= means q=1.0
  }
  return false;
}

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
