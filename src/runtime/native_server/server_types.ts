import type { Server as HttpServer } from "http";
import type { Response } from "../../server/response";
import type { Request } from "../../server/request";
import type { RunTimeType } from "../runtime";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type RuntimeServer =
  | HttpServer
  | ReturnType<typeof Bun.serve>
  | ReturnType<typeof Deno.serve>;

export type RuntimeServerMap<T extends RunTimeType> = T extends "bun"
  ? ReturnType<typeof Bun.serve>
  : T extends "node"
  ? HttpServer
  : T extends "deno"
  ? ReturnType<typeof Deno.serve>
  : never;

export interface ServerConnectInput {
  /** The port to listen on, defaults to 80 */
  port: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host: string;
  /** The server routes with their corresponding handler */
  routes: ServerRoute[];
}

export type ServerRouteMiddleware = (
  req: Request,
  res: Response,
  next: () => void | Promise<void>
) => void | Promise<void>;
export type ServerRouteHandler = (
  req: Request,
  res: Response
) => void | Promise<void>;

export interface ServerRoute {
  /** The path for the route */
  path: string;
  /** The HTTP method for the route */
  method: HttpMethod;
  /** The handler to call when the route is requested */
  handler: ServerRouteHandler;
  /** The middleware chain to call before the handler */
  middlewares?: ServerRouteMiddleware[];
}

export type ServerListenCallback = ({
  port,
  host,
  url,
}: {
  port: number;
  host: string;
  url: string;
}) => void;
