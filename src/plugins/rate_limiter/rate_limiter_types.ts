import type { Request } from "../../server/http/request.js";

/**
 * Rate limiter key generation strategies
 */
export type RateLimiterKeyStrategy = "ip" | "custom";

export type StorageStrategy = "memory" | "custom";

type BaseRateLimiterOptions = {
  /**
   * The number of requests per window
   * @default 100
   */
  limit?: number;

  /**
   * The message to return when the rate limit is exceeded
   * @default "ERR_RATE_LIMIT_EXCEEDED"
   */
  message?: string;

  /**
   * The status code to return when the rate limit is exceeded
   * @default 429
   */
  statusCode?: number;

  /**
   * The storage strategy to use
   * @default "memory"
   */
  storageStrategy?: StorageStrategy;

  /**
   * When storage throws, return 429 (fail closed) instead of allowing the request (fail open).
   * @default false
   */
  failClosed?: boolean;
};

/**
 * Key Strategy
 */
export type IpRateLimiterOptions = {
  /**
   * The type of rate limiter
   */
  type: "ip";
} & BaseRateLimiterOptions;

export type CustomRateLimiterOptions = {
  /**
   * The type of rate limiter
   */
  type: "custom";

  /**
   * Generate a key for the rate limiter from the request (e.g. user id, email, etc.)
   */
  key: (req: Request) => string;

  /**
   * The storage strategy to use
   * @default "memory"
   */
  storageStrategy?: StorageStrategy;
} & BaseRateLimiterOptions;

/**
 * Memory Storage Strategy
 */
export type MemoryStorageStrategy = {
  /**
   * The type of storage strategy
   */
  type: "memory";

  /**
   * The window in milliseconds
   * @default 60000
   */
  windowMs?: number;

  /**
   * Maximum number of unique keys to track. When full, the oldest key is evicted.
   * Protects against memory exhaustion from attacker-controlled key cardinality.
   * @default 100000
   */
  maxKeys?: number;
};

/**
 * Atomic increment result returned by custom storage.
 */
export type IncrementResult = {
  /** Current request count for this key in the active window */
  count: number;
  /** Unix timestamp (ms) when the current window resets */
  resetAt: number;
};

/**
 * Custom Storage Strategy.
 * Must implement an atomic increment that initialises a new fixed window on first call
 * or after window expiry.
 */
export type CustomStorageStrategy = {
  /**
   * The type of storage strategy
   */
  type: "custom";

  /**
   * Atomically increment the counter for `key` within a `windowMs`-wide fixed window.
   * Should create a new window if none exists or the current one has expired.
   * Returns the updated count and the window's reset timestamp.
   */
  increment: (key: string, windowMs: number) => Promise<IncrementResult>;
};

export type StorageOptions = MemoryStorageStrategy | CustomStorageStrategy;

/**
 * Rate limiter options
 */
export type RateLimiterKeyOptions =
  | IpRateLimiterOptions
  | CustomRateLimiterOptions;
