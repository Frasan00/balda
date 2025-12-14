import { GraphQL } from "src/graphql/graphql";
import type { RuntimeServer, ServerRoute } from "./server_types";

/**
 * Standard interface for server implementations between different environments.
 */
export interface ServerInterface {
  /** The graphql instance for the server */
  graphql: GraphQL;
  /** The runtime the server is running on */
  runtimeServer: RuntimeServer;
  /** The port the server is listening on */
  port: number;
  /** The hostname the server is listening on */
  host: string;
  /** The URL the server is listening on */
  url: string;
  /** The routes the server is listening on */
  routes: ServerRoute[];
  /** Connect to the server */
  listen(): void;
  /** Close the server */
  close(): Promise<void>;
}
