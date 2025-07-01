import { type RunTimeType } from "../runtime";
import { ServerBun } from "./server_bun";
import { ServerDeno } from "./server_deno";
import type { ServerInterface } from "./server_interface";
import { ServerNode } from "./server_node";
import type {
  RuntimeServerMap,
  ServerConnectInput,
  ServerRoute,
} from "./server_types";

export class ServerConnector {
  declare routes: ServerRoute[];

  private server: ServerInterface;

  constructor(serverOptions?: ServerConnectInput) {
    this.server = this.getRuntimeServer(serverOptions);
    this.routes = this.server.routes;
  }

  get url(): string {
    return this.server.url;
  }

  get port(): number {
    return this.server.port;
  }

  get host(): string {
    return this.server.host;
  }

  /**
   * Get the server for the given runtime
   * @example "node" returns HttpServer
   * @example "bun" returns ReturnType<typeof Bun.serve>
   * @example "deno" returns ReturnType<typeof Deno.serve>
   * @param _ - The runtime to get the server for
   * @returns The server for the given runtime
   */
  getServer<T extends RunTimeType>(_: T): RuntimeServerMap<T> {
    return this.server.runtimeServer as RuntimeServerMap<T>;
  }

  listen(): void {
    return this.server.listen();
  }

  close(): Promise<void> {
    return this.server.close();
  }

  private getRuntimeServer(
    serverOptions?: ServerConnectInput,
  ): ServerInterface {
    if (serverOptions?.runtime === "bun") {
      return new ServerBun(serverOptions);
    } else if (serverOptions?.runtime === "node") {
      return new ServerNode(serverOptions);
    } else if (serverOptions?.runtime === "deno") {
      return new ServerDeno(serverOptions);
    }

    // TODO: BaldaError implementation
    throw new Error(
      "No server implementation found for runtime: " + serverOptions?.runtime,
    );
  }
}
