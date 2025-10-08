import type { SessionStore } from "./session_types";

export class MemorySessionStore implements SessionStore {
  private store = new Map<
    string,
    { value: Record<string, any>; exp?: number }
  >();

  async get(sid: string): Promise<Record<string, any> | undefined> {
    const entry = this.store.get(sid);
    if (!entry) {
      return;
    }

    if (entry.exp && Date.now() > entry.exp) {
      this.store.delete(sid);
      return;
    }

    return entry.value;
  }

  async set(
    sid: string,
    value: Record<string, any>,
    ttlSeconds?: number,
  ): Promise<void> {
    const exp = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(sid, { value, exp });
  }

  async destroy(sid: string): Promise<void> {
    this.store.delete(sid);
  }
}
