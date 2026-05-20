export type SessionStore = {
  get: (sid: string) => Promise<Record<string, any> | undefined>;
  set: (
    sid: string,
    value: Record<string, any>,
    ttlSeconds?: number,
  ) => Promise<void>;
  destroy: (sid: string) => Promise<void>;
};

export type SessionOptions = {
  /** Cookie name used for session id */
  name?: string;
  /**
   * Secret for signing the session cookie (sets `signed: true` on the session cookie).
   * Requires `cookie({ sign: true, secret })` with the same secret.
   */
  secret?: string;
  /** TTL seconds for session */
  ttl?: number;
  /** Custom store, default is in-memory */
  store?: SessionStore;
  /** Whether to set HttpOnly secure flags */
  cookie?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    domain?: string;
  };
};
