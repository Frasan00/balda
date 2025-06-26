import type { ServerRouteHandler, ServerRouteMiddleware } from "../../runtime/native_server/server_types";

export type Params = Record<string, string>

export interface Route {
  method: string
  path: string
  middleware: ServerRouteMiddleware[]
  handler: ServerRouteHandler
}
