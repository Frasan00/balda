import type { CachePluginOptionsResolved } from "./cache.types.js";

/**
 * Default cache plugin options.
 */
export const DEFAULT_CACHE_OPTIONS: CachePluginOptionsResolved = {
  /** 5 minutes default TTL */
  defaultTtl: 300,
  /** Apply compression for responses > 1KB */
  compressionThreshold: 1024,
  /** Cache key prefix */
  keyPrefix: "cache",
  /** Enable hit/miss statistics */
  enableStats: true,
  /** 5 seconds lock timeout for thundering herd protection */
  lockTimeout: 5000,
  /** Default behavior when lock cannot be acquired */
  lockBehavior: "wait",
};

/**
 * Maximum allowed TTL (24 hours).
 */
export const MAX_TTL_SECONDS = 86400;

/**
 * Polling interval when waiting for cache during thundering herd (ms).
 */
export const CACHE_POLL_INTERVAL_MS = 50;

/**
 * Response header name for cache status.
 */
export const CACHE_STATUS_HEADER = "x-cache";

/**
 * Cache status values for response header.
 */
export enum CacheStatus {
  Hit = "HIT",
  Miss = "MISS",
  Wait = "WAIT",
  Bypass = "BYPASS",
}
