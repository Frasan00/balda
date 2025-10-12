// Decorators
export * from "./decorators/controller/controller";
export * from "./decorators/handlers/del";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/middleware/middleware";
export * from "./decorators/validation/validate";

// Server
export * from "./server/http/next";
export * from "./server/http/request";
export * from "./server/http/response";
export * from "./server/server";
export * from "./server/server_types";
export * from "./runtime/native_server/server_types";

// Plugins
export * from "./plugins/cors/cors";
export * from "./plugins/json/json";
export * from "./plugins/static/static";
export * from "./plugins/cookie/cookie";
export * from "./plugins/base_plugin";
export * from "./plugins/rate_limiter/rate_limiter";
export * from "./plugins/log/log";
export * from "./plugins/file/file";
export * from "./plugins/helmet/helmet";
export * from "./plugins/urlencoded/urlencoded";
export * from "./plugins/session/session";
export * from "./plugins/trust_proxy/trust_proxy";
export * from "./plugins/timeout/timeout";

// Router
import type { ClientRouter } from "./server/router/router_type";
import { router as routerInstance } from "./server/router/router";
/**
 * Singleton main router instance that handles all route registrations inside the balda server
 */
export const router = routerInstance as ClientRouter;
