import type { ServerRouteMiddleware } from "../runtime/native_server/server_types.js";

/**
 * Base class for all plugins.
 *
 * Plugins are used to extend the functionality of the server.
 *
 * @example
 * ```ts
 * import { Server, BasePlugin } from "balda-js";
 *
 * export class MyPlugin extends BasePlugin {
 *   async handle(): Promise<ServerRouteMiddleware> {
 *     return async (req, res, next) => {
 *       console.log("My plugin is running");
 *       await next();
 *     };
 *   }
 * }
 *
 * const server = new Server();
 * server.use(new MyPlugin().handle());
 * ```
 *
 * @abstract
 */
export abstract class BasePlugin {
  abstract handle(...args: any[]): Promise<ServerRouteMiddleware>;
}
