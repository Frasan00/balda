import type { IncrementResult } from "./rate_limiter_types.js";

export interface InMemoryStorageInterface {
  increment(key: string, windowMs: number): Promise<IncrementResult>;
}

type WindowEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_MAX_KEYS = 100_000;

export class InMemoryStorage implements InMemoryStorageInterface {
  private storage: Map<string, WindowEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(windowMs: number, maxKeys: number = DEFAULT_MAX_KEYS) {
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  async increment(key: string, windowMs: number): Promise<IncrementResult> {
    const now = Date.now();
    const win = windowMs || this.windowMs;
    const existing = this.storage.get(key);

    if (existing && existing.resetAt > now) {
      // Within active window — increment in place
      existing.count += 1;
      return { count: existing.count, resetAt: existing.resetAt };
    }

    // Expired or new key — start fresh window
    if (!existing && this.storage.size >= this.maxKeys) {
      // Evict the oldest entry (first key in Map insertion order)
      const firstKey = this.storage.keys().next().value;
      if (firstKey !== undefined) {
        this.storage.delete(firstKey);
      }
    } else if (existing) {
      // Re-use existing slot (no size change)
      existing.count = 1;
      existing.resetAt = now + win;
      return { count: 1, resetAt: existing.resetAt };
    }

    const entry: WindowEntry = { count: 1, resetAt: now + win };
    this.storage.set(key, entry);
    return { count: 1, resetAt: entry.resetAt };
  }
}
