import { createHash } from "crypto";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";
import type {
  CacheRouteConfig,
  CacheRouteConfigResolved,
} from "./cache.types.js";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Generates a deterministic cache key from request parameters.
 *
 * Key format: `{prefix}:global:{method}:{route}:{paramsHash}:{q:queryHash}:{b:bodyHash}:{h:headersHash}`
 *
 * Segments with no data are omitted. Params are always included.
 */
export function generateCacheKey(params: {
  prefix: string;
  method: string;
  route: string;
  routeParams?: Record<string, string>;
  body?: unknown;
  bodyKeys?: string[];
  includeBody?: boolean;
  query?: Record<string, string>;
  queryKeys?: string[];
  includeQuery?: boolean;
  headers?: Record<string, string>;
  headerKeys?: string[];
  includeHeaders?: boolean;
  /** Pre-resolved value from include.fromRequest (already awaited by the middleware) */
  fromRequestValue?: unknown;
}): string {
  const {
    prefix,
    method,
    route,
    routeParams,
    body,
    bodyKeys,
    includeBody = true,
    query,
    queryKeys,
    includeQuery = false,
    headers,
    headerKeys,
    includeHeaders = false,
    fromRequestValue,
  } = params;

  const segments = [prefix, "global"];

  segments.push(method.toUpperCase(), normalizeRoute(route));

  // Params are always included
  if (routeParams && Object.keys(routeParams).length > 0) {
    segments.push(hashData(routeParams));
  }

  // Query - included based on config
  if (includeQuery && query) {
    const selectedQuery = selectKeys(query, queryKeys);
    if (Object.keys(selectedQuery).length > 0) {
      segments.push("q:" + hashData(selectedQuery));
    }
  }

  // Body - included based on config
  if (includeBody && body != null) {
    const selectedBody = selectKeys(body as Record<string, unknown>, bodyKeys);
    segments.push("b:" + hashData(selectedBody));
  }

  // Headers - included based on config
  if (includeHeaders && headers) {
    const selectedHeaders = selectKeys(headers, headerKeys);
    if (Object.keys(selectedHeaders).length > 0) {
      segments.push("h:" + hashData(selectedHeaders));
    }
  }

  // fromRequest discriminator
  if (fromRequestValue != null) {
    segments.push("c:" + hashData(fromRequestValue));
  }

  return segments.join(":");
}

/**
 * Extracts specified keys from an object for cache key generation.
 *
 * @param data - Source object
 * @param keys - Keys to extract (if undefined/empty, returns entire object)
 * @returns Object with only specified keys
 */
export function selectKeys<T extends Record<string, unknown>>(
  data: T,
  keys?: string[],
): Record<string, unknown> {
  if (!keys || keys.length === 0) {
    return data;
  }

  const selected: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in data) {
      selected[key] = data[key];
    }
  }
  return selected;
}

/**
 * SHA256 hash of JSON-serialized data, truncated to 16 bytes (32 hex chars).
 * Uses sorted keys for deterministic output.
 */
export function hashData(data: unknown): string {
  const serialized = stableStringify(data);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return hash.substring(0, 32);
}

/**
 * Deterministic JSON serialization with sorted keys.
 */
export function stableStringify(data: unknown): string {
  if (data === null) {
    return "null";
  }
  if (data === undefined) {
    return "";
  }
  if (typeof data !== "object") {
    return JSON.stringify(data);
  }
  if (Array.isArray(data)) {
    // undefined in arrays → "null" (mirrors JSON.stringify behaviour)
    return (
      "[" + data.map((item) => stableStringify(item) || "null").join(",") + "]"
    );
  }
  // Skip undefined-valued keys (mirrors JSON.stringify behaviour)
  const sortedKeys = Object.keys(data as Record<string, unknown>)
    .filter((key) => (data as Record<string, unknown>)[key] !== undefined)
    .sort();
  const parts = sortedKeys.map(
    (key) =>
      JSON.stringify(key) +
      ":" +
      stableStringify((data as Record<string, unknown>)[key]),
  );
  return "{" + parts.join(",") + "}";
}

/**
 * Normalize route path for consistent key generation.
 * - Converts to lowercase
 * - Collapses multiple slashes
 * - Removes trailing slash
 */
export function normalizeRoute(route: string): string {
  return route.toLowerCase().replace(/\/+/g, "/").replace(/\/$/, "");
}

/**
 * Generate lock key for thundering herd protection.
 */
export function generateLockKey(cacheKey: string): string {
  return `lock:${cacheKey}`;
}

/**
 * Generate key for tag-based invalidation set.
 */
export function generateTagKey(prefix: string, tag: string): string {
  return `${prefix}:tag:${tag}`;
}

/**
 * Compress data using gzip.
 */
export async function compress(data: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(data, "utf-8"));
}

/**
 * Decompress gzipped data.
 */
export async function decompress(data: Buffer): Promise<string> {
  const result = await gunzipAsync(data);
  return result.toString("utf-8");
}

/**
 * Resolve a CacheRouteConfig into a CacheRouteConfigResolved by normalizing
 * the `include` field into explicit boolean/string[] properties.
 */
export function resolveCacheConfig(
  config: CacheRouteConfig,
): CacheRouteConfigResolved {
  const include = config.include;

  let includeBody = true;
  let includeQuery = false;
  let includeHeaders = false;
  let bodyKeys: string[] | undefined;
  let queryKeys: string[] | undefined;
  let headerKeys: string[] | undefined;

  if (include) {
    // Body
    if (include.body === false) {
      includeBody = false;
    } else if (Array.isArray(include.body)) {
      includeBody = true;
      bodyKeys = include.body as string[];
    } else if (include.body === true) {
      includeBody = true;
    }
    // If include is specified but body is undefined, default to not including body
    if (include.body === undefined) {
      includeBody = false;
    }

    // Query
    if (include.query === true) {
      includeQuery = true;
    } else if (Array.isArray(include.query)) {
      includeQuery = true;
      queryKeys = include.query as string[];
    }

    // Headers
    if (include.headers === true) {
      includeHeaders = true;
    } else if (Array.isArray(include.headers)) {
      includeHeaders = true;
      headerKeys = include.headers as string[];
    }
  }

  return {
    ttl: config.ttl,
    useCompression: config.useCompression,
    tags: config.tags,
    lockBehavior: config.lockBehavior,
    includeBody,
    includeQuery,
    includeHeaders,
    bodyKeys,
    queryKeys,
    headerKeys,
    fromRequest: include?.fromRequest,
  };
}
