import type { Server as HttpServer, IncomingMessage } from "http";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";
import type { RunTimeType } from "../runtime";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type RuntimeServer =
  | HttpServer
  | ReturnType<typeof Bun.serve>
  | ReturnType<typeof Deno.serve>;

export type RuntimeServerMap<T extends RunTimeType> = T extends "node"
  ? HttpServer
  : never;

export interface ServerConnectInput {
  /** The port to listen on, defaults to 80 */
  port: number;
  /** The hostname to listen on, defaults to 0.0.0.0 */
  host: string;
  /** The server routes with their corresponding handler */
  routes: ServerRoute[];
  /** The options for the server tap function */
  tapOptions?: ServerTapOptions;
  /** The runtime to use for the server */
  runtime: RunTimeType;
}

export type ServerRouteMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

export type ServerRouteHandler = (
  req: Request,
  res: Response,
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

/**
 * Custom bun fetch call to be used as an hook inside Bun.serve method
 */
type CustomBunFetch = (
  ...options: Parameters<Bun.ServeOptions["fetch"]>
) => Promise<void> | void;

/**
 * Custom deno fetch call to be used as an hook inside Deno.serve method
 */
type CustomDenoFetch = (
  ...options: Parameters<Parameters<typeof Deno.serve>[0]["handler"]>
) => Promise<void> | void;

type BunServeOptions = Bun.ServeFunctionOptions<unknown, any>;

/**
 * The options for the server tap function, allows you to interact with the server behavior before it is used to listen for incoming requests
 */
export type ServerTapOptionsBuilder<T extends RunTimeType> = T extends "node"
  ? (req: Omit<IncomingMessage, "url">) => Promise<void>
  : T extends "bun"
    ? Partial<Parameters<typeof Bun.serve>[0]> & {
        fetch?: CustomBunFetch;
      }
    : T extends "deno"
      ? Partial<Omit<Parameters<typeof Deno.serve>[0], "handler">> & {
          handler?: CustomDenoFetch;
        }
      : never;

export type BunTapOptions = {
  type: "bun";
  options: ServerTapOptionsBuilder<"bun">;
};

export type NodeTapOptions = {
  type: "node";
  options: ServerTapOptionsBuilder<"node">;
};

export type DenoTapOptions = {
  type: "deno";
  options: ServerTapOptionsBuilder<"deno">;
};

export type ServerTapOptions = BunTapOptions | NodeTapOptions | DenoTapOptions;
