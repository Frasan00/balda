// Decorators
export * from "./cron/decorator/cron_decorator";
export * from "./decorators/command/arg";
export * from "./decorators/command/flag";
export * from "./decorators/controller/controller";
export * from "./decorators/handlers/del";
export * from "./decorators/handlers/get";
export * from "./decorators/handlers/patch";
export * from "./decorators/handlers/post";
export * from "./decorators/handlers/put";
export * from "./decorators/middleware/middleware";
export * from "./decorators/serialize/serialize";
export * from "./decorators/serialize/serialize_types";
export * from "./decorators/validation/validate";
export * from "./decorators/validation/validate_types";

// Cron
export * from "./cron/cron";
export * from "./cron/cron.types";
export * from "./queue/decorator/queue_decorator";
export * from "./queue/queue_service";

// Queue
export * from "./queue/providers/bullmq/bullmq";
export type {
  BullMQConfiguration,
  BullMQConfigurationOptions,
} from "./queue/providers/bullmq/bullmq_configuration";
export type { CustomQueueConfiguration } from "./queue/providers/custom/custom";
export * from "./queue/providers/pgboss/pgboss";
export type {
  PGBossConfiguration,
  PGBossConfigurationOptions,
} from "./queue/providers/pgboss/pgboss_configuration";
export * from "./queue/providers/sqs/sqs";
export type {
  SQSConfiguration,
  SQSConfigurationOptions,
} from "./queue/providers/sqs/sqs_configuration";
export * from "./queue/pub";
export * from "./queue/queue";
export * from "./queue/queue_config";
export * from "./queue/queue_types";

// Logger
export * from "./logger/logger";
export * from "./logger/logger_types";

// Commands
export * from "./commands/base_command";
export * from "./commands/command_registry";
export * from "./commands/command_types";

// Server
export type { MockServer } from "./mock/mock_server";
export * from "./mock/mock_server_types";
export * from "./runtime/native_server/server_types";
export * from "./server/http/next";
export * from "./server/http/request";
export * from "./server/http/response";
export * from "./server/server";
export * from "./server/server_types";

// Plugins
export * from "./plugins/base_plugin";
export * from "./plugins/cookie/cookie";
export * from "./plugins/cors/cors";
export * from "./plugins/file/file";
export * from "./plugins/helmet/helmet";
export * from "./plugins/json/json";
export * from "./plugins/log/log";
export * from "./plugins/rate_limiter/rate_limiter";
export * from "./plugins/session/session";
export * from "./plugins/static/static";
export * from "./plugins/timeout/timeout";
export * from "./plugins/trust_proxy/trust_proxy";
export * from "./plugins/urlencoded/urlencoded";

// Router
import { router as routerInstance } from "./server/router/router";
import type { ClientRouter } from "./server/router/router_type";
/**
 * Singleton main router instance that handles all route registrations inside the balda server
 */
export const router = routerInstance as ClientRouter;
