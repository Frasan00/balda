// Decorators
export * from "./cron/decorator/cron_decorator.js";
export * from "./decorators/command/arg.js";
export * from "./decorators/command/flag.js";
export * from "./decorators/controller/controller.js";
export * from "./decorators/handlers/del.js";
export * from "./decorators/handlers/get.js";
export * from "./decorators/handlers/patch.js";
export * from "./decorators/handlers/post.js";
export * from "./decorators/handlers/put.js";
export * from "./decorators/middleware/middleware.js";
export * from "./decorators/serialize/serialize.js";
export * from "./decorators/serialize/serialize_types.js";
export * from "./decorators/validation/validate.js";
export * from "./decorators/validation/validate_types.js";

// Cron
export * from "./cron/base_cron.js";
export * from "./cron/cron.js";
export * from "./cron/cron.types.js";
export * from "./queue/decorator/queue_decorator.js";
export * from "./queue/queue_service.js";

// Queue
export * from "./queue/base_queue.js";
export * from "./queue/providers/bullmq/bullmq.js";
export type {
  BullMQConfiguration,
  BullMQConfigurationOptions,
} from "./queue/providers/bullmq/bullmq_configuration.js";
export type { CustomQueueConfiguration } from "./queue/providers/custom/custom.js";
export * from "./queue/providers/pgboss/pgboss.js";
export type {
  PGBossConfiguration,
  PGBossConfigurationOptions,
} from "./queue/providers/pgboss/pgboss_configuration.js";
export * from "./queue/providers/sqs/sqs.js";
export type {
  SQSConfiguration,
  SQSConfigurationOptions,
} from "./queue/providers/sqs/sqs_configuration.js";
export * from "./queue/pub.js";
export * from "./queue/queue.js";
export * from "./queue/queue_config.js";
export * from "./queue/queue_service.js";
export * from "./queue/queue_types.js";

// Logger
export * from "./logger/logger.js";
export * from "./logger/logger_types.js";

// Commands
export * from "./commands/base_command.js";
export * from "./commands/command_registry.js";
export * from "./commands/command_types.js";

// Server
export type { MockServer } from "./mock/mock_server.js";
export * from "./mock/mock_server_types.js";
export * from "./runtime/native_server/server_types.js";
export * from "./server/http/next.js";
export * from "./server/http/request.js";
export * from "./server/http/response.js";
export * from "./server/server.js";
export * from "./server/server_types.js";

// hash
export { hash } from "./runtime/native_hash.js";

// GraphQL
export * from "./graphql/graphql.js";
export * from "./graphql/graphql_types.js";

// Plugins
export * from "./plugins/base_plugin.js";
export * from "./plugins/compression/compression.js";
export * from "./plugins/cookie/cookie.js";
export * from "./plugins/cors/cors.js";
export * from "./plugins/express/express.js";
export * from "./plugins/express/express_types.js";
export * from "./plugins/file/file.js";
export * from "./plugins/helmet/helmet.js";
export * from "./plugins/json/json.js";
export * from "./plugins/log/log.js";
export * from "./plugins/method_override/method_override.js";
export * from "./plugins/rate_limiter/rate_limiter.js";
export * from "./plugins/session/session.js";
export * from "./plugins/static/static.js";
export * from "./plugins/static/static_types.js";
export * from "./plugins/timeout/timeout.js";
export * from "./plugins/trust_proxy/trust_proxy.js";
export * from "./plugins/urlencoded/urlencoded.js";

// Policy
export * from "./server/policy/policy_decorator.js";
export * from "./server/policy/policy_manager.js";
export * from "./server/policy/policy_types.js";

// Router
import { router as routerInstance } from "./server/router/router.js";
import type { ClientRouter } from "./server/router/router_type.js";
/**
 * Singleton main router instance that handles all route registrations inside the balda server
 */
export const router = routerInstance as ClientRouter;
