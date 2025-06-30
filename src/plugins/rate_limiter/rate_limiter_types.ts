import type { Request } from "../../server/http/request";

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
};

/**
 * Custom Storage Strategy
 */
export type CustomStorageStrategy = {
  /**
   * The type of storage strategy
   */
  type: "custom";

  /**
   * Set a value in the storage
   */
  set: (key: string, value: any) => Promise<void>;

  /**
   * Get a value from the storage
   */
  get: (key: string) => Promise<any>;
};

export type StorageOptions = MemoryStorageStrategy | CustomStorageStrategy;

/**
 * Rate limiter options
 */
export type RateLimiterKeyOptions =
  | IpRateLimiterOptions
  | CustomRateLimiterOptions;
