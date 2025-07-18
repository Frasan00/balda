export interface InMemoryStorageInterface {
  get: (key: string) => Promise<number>;
  set: (key: string, value: number) => Promise<void>;
}

export class InMemoryStorage implements InMemoryStorageInterface {
  private storage: Map<string, number> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async set(key: string, value: number): Promise<void> {
    this.storage.set(key, value);
    setTimeout(() => {
      this.storage.delete(key);
    }, this.windowMs);
  }

  async get(key: string): Promise<number> {
    const entry = this.storage.get(key);
    if (!entry) {
      return 0;
    }

    return entry;
  }

  protected async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
}
