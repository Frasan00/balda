import { SyncOrAsync } from "../../type_util.js";

export interface AsyncLocalStorageContext {}

export type AsyncLocalStorageContextSetters<
  K extends keyof AsyncLocalStorageContext = keyof AsyncLocalStorageContext,
> = Record<K, () => SyncOrAsync<AsyncLocalStorageContext[K]>>;
