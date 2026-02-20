import type { CacheProvider } from "../cache.types.js";

/**
 * In-memory cache provider using Map with TTL expiration.
 * Suitable for development, testing, and single-instance deployments.
 */
export class MemoryCacheProvider implements CacheProvider {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private sets = new Map<string, { members: Set<string>; expiresAt: number }>();
  private locks = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key) || this.sets.delete(key);
  }

  async delMany(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
      else if (this.sets.delete(key)) count++;
    }
    return count;
  }

  async addToSet(
    key: string,
    members: string[],
    ttlSeconds?: number,
  ): Promise<void> {
    let entry = this.sets.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      entry = {
        members: new Set(),
        expiresAt: ttlSeconds
          ? Date.now() + ttlSeconds * 1000
          : Number.MAX_SAFE_INTEGER,
      };
      this.sets.set(key, entry);
    }
    for (const m of members) {
      entry.members.add(m);
    }
    if (ttlSeconds) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    const entry = this.sets.get(key);
    if (!entry) return [];
    if (Date.now() > entry.expiresAt) {
      this.sets.delete(key);
      return [];
    }
    return Array.from(entry.members);
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(key);
    if (existing && Date.now() < existing) {
      return false;
    }
    this.locks.set(key, Date.now() + ttlMs);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async *scan(pattern: string): AsyncIterable<string[]> {
    const regex = globToRegex(pattern);
    const batch: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        const entry = this.store.get(key)!;
        if (Date.now() <= entry.expiresAt) {
          batch.push(key);
          if (batch.length >= 100) {
            yield [...batch];
            batch.length = 0;
          }
        }
      }
    }
    if (batch.length > 0) {
      yield batch;
    }
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.sets.clear();
    this.locks.clear();
  }
}

/**
 * Convert a glob pattern (with * wildcard) to a RegExp.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$");
}
