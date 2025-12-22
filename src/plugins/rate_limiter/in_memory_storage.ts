export interface InMemoryStorageInterface {
  get: (key: string) => Promise<number>;
  set: (key: string, value: number) => Promise<void>;
}

export class InMemoryStorage implements InMemoryStorageInterface {
  private storage: Map<string, number> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async set(key: string, value: number): Promise<void> {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.storage.set(key, value);

    const timerId = setTimeout(() => {
      this.storage.delete(key);
      this.timers.delete(key);
    }, this.windowMs);

    this.timers.set(key, timerId);
  }

  async get(key: string): Promise<number> {
    const entry = this.storage.get(key);
    if (!entry) {
      return 0;
    }

    return entry;
  }

  protected async delete(key: string): Promise<void> {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
    }
    this.storage.delete(key);
    this.timers.delete(key);
  }
}
