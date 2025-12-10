import type { Server as HttpServer, IncomingMessage } from "node:http";
import { type Http2Server } from "node:http2";
import {
  Server as HttpsServer,
  type ServerOptions as HttpsServerOptions,
} from "node:https";
import { type NodeHttpClient } from "src/server/server_types";
import type { SyncOrAsync } from "src/type_util";
import type { NextFunction } from "../../server/http/next";
import type { Request as BaldaRequest } from "../../server/http/request";
import type { Response as BaldaResponse } from "../../server/http/response";
import type { RunTimeType } from "../runtime";

export type { HttpsServerOptions };

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD";

export type NodeServer = HttpServer | HttpsServer | Http2Server;

export type RuntimeServer =
  | NodeServer
  | ReturnType<typeof Bun.serve>
  | ReturnType<typeof Deno.serve>;

export type RuntimeServerMap<T extends RunTimeType> = T extends "node"
  ? HttpServer
  : T extends "bun"
    ? ReturnType<typeof Bun.serve>
    : T extends "deno"
      ? ReturnType<typeof Deno.serve>
      : never;

export type HttpsOptions<T extends NodeHttpClient> = T extends "https"
  ? {
      /** HTTPS/TLS options, required when nodeHttpClient is 'https' */
      httpsOptions: HttpsServerOptions;
    }
  : never;

export type ServerConnectInput<H extends NodeHttpClient = NodeHttpClient> = {
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
  /** Specific node client to use */
  nodeHttpClient: H;
} & (H extends "https" ? HttpsOptions<H> : {});

export type ServerRouteMiddleware = (
  req: BaldaRequest,
  res: BaldaResponse,
  next: NextFunction,
) => SyncOrAsync;

export type ServerRouteHandler = (
  req: BaldaRequest,
  res: BaldaResponse,
) => SyncOrAsync;

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
}) => SyncOrAsync;

/**
 * Custom bun fetch call to be used as an hook inside Bun.serve method
 */
type CustomBunFetch = (
  req: BaldaRequest,
  server: Bun.Server<any>,
) => SyncOrAsync;

/**
 * Custom deno fetch call to be used as an hook inside Deno.serve method
 */
type CustomDenoFetch = (
  ...options: Parameters<Parameters<typeof Deno.serve>[0]["handler"]>
) => SyncOrAsync<Response | void>;

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

export type BunTapOptions = ServerTapOptionsBuilder<"bun">;
export type NodeTapOptions = ServerTapOptionsBuilder<"node">;
export type DenoTapOptions = ServerTapOptionsBuilder<"deno">;
export type ServerTapOptions = {
  bun?: BunTapOptions;
  node?: NodeTapOptions;
  deno?: DenoTapOptions;
};
