import { SyncOrAsync } from "../../type_util.js";
import { Request } from "../../server/http/request.js";

export interface AsyncLocalStorageContext {}

export type AsyncLocalStorageContextSetters<
  K extends keyof AsyncLocalStorageContext = keyof AsyncLocalStorageContext,
> = Record<K, (req: Request) => SyncOrAsync<AsyncLocalStorageContext[K]>>;
