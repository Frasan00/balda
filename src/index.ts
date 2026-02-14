// Decorators
export { cron } from "./cron/decorator/cron_decorator.js";
export { arg } from "./decorators/command/arg.js";
export { flag } from "./decorators/command/flag.js";
export { controller } from "./decorators/controller/controller.js";
export { del } from "./decorators/handlers/del.js";
export { get } from "./decorators/handlers/get.js";
export { patch } from "./decorators/handlers/patch.js";
export { post } from "./decorators/handlers/post.js";
export { put } from "./decorators/handlers/put.js";
export type {
  TypedHandler,
  TypedRouteMetadata,
} from "./decorators/handlers/typed_handlers.js";
export { middleware } from "./decorators/middleware/middleware.js";
export { serialize } from "./decorators/serialize/serialize.js";
export type { SerializeOptions } from "./decorators/serialize/serialize_types.js";
export { validate } from "./decorators/validation/validate.js";
export type {
  CustomValidationError,
  RequestSchema,
  ValidationOptions,
  ValidatedData,
} from "./decorators/validation/validate_types.js";

// Cron
export { BaseCron } from "./cron/base_cron.js";
export { CronService, setCronGlobalErrorHandler } from "./cron/cron.js";
export type {
  CronSchedule,
  CronScheduleParams,
  CronUIOptions,
} from "./cron/cron.types.js";

// MQTT
export { MqttService, setMqttGlobalErrorHandler, mqtt } from "./mqtt/mqtt.js";
export type {
  MqttTopics,
  MqttHandler,
  MqttConnectionOptions,
  MqttPublishOptions,
  MqttSubscribeOptions,
  MqttSubscription,
  PublishTopic,
} from "./mqtt/mqtt.types.js";

// Queue
export {
  bullmqQueue,
  createQueue,
  memoryQueue,
  pgbossQueue,
  sqsQueue,
} from "./queue/factories.js";
export { BullMQPubSub } from "./queue/providers/bullmq/bullmq.js";
export type {
  BullMQConfiguration,
  BullMQConfigurationOptions,
} from "./queue/providers/bullmq/bullmq_configuration.js";
export type { CustomQueueConfiguration } from "./queue/providers/custom/custom.js";
export { MemoryPubSub } from "./queue/providers/memory/memory.js";
export { PGBossPubSub } from "./queue/providers/pgboss/pgboss.js";
export type {
  PGBossConfiguration,
  PGBossConfigurationOptions,
} from "./queue/providers/pgboss/pgboss_configuration.js";
export { SQSPubSub } from "./queue/providers/sqs/sqs.js";
export type {
  SQSConfiguration,
  SQSConfigurationOptions,
} from "./queue/providers/sqs/sqs_configuration.js";
export { QueueManager } from "./queue/queue.js";
export { defineQueueConfiguration } from "./queue/queue_config.js";
export { QueueService } from "./queue/queue_service.js";
export type { CustomTypedQueue, TypedQueue } from "./queue/typed_queue.js";

// Logger
export { logger } from "./logger/logger.js";
export type { LoggerOptions } from "./logger/logger_types.js";

// Commands
export { Command } from "./commands/base_command.js";
export {
  commandRegistry,
  CommandRegistry,
} from "./commands/command_registry.js";
export type { CommandOptions } from "./commands/command_types.js";

// Server
export type { MockResponse } from "./mock/mock_response.js";
export type { MockServer } from "./mock/mock_server.js";
export type { MockServerOptions } from "./mock/mock_server_types.js";
export type {
  HttpMethod,
  NodeServer as NodeHttpServerClient,
  ServerRouteMiddleware,
  ServerRouteHandler,
  HttpsOptions,
  ServerListenCallback,
  RuntimeServer,
  ServerConnectInput,
  ServerTapOptions,
} from "./runtime/native_server/server_types.js";
export type { NextFunction } from "./server/http/next.js";
export type { Request } from "./server/http/request.js";
export type { Response } from "./server/http/response.js";
export type {
  ExtractParams,
  InferResponseMap,
  InferSchemaType,
  ResponseBodyForStatus,
} from "./server/router/path_types.js";
export type {
  NodeHttpClient,
  ServerErrorHandler,
  ServerHook,
  ServerInterface,
  ServerOptions,
  SignalEvent,
} from "./server/server_types.js";

import { Server } from "./server/server.js";
export { Server };

// hash
export { hash } from "./runtime/native_hash.js";

// GraphQL
export { GraphQL } from "./graphql/graphql.js";
export type {
  GraphQLContext,
  GraphQLOptions,
  GraphQLResolverFunction,
  GraphQLResolverMap,
  GraphQLResolvers,
  GraphQLResolverType,
  GraphQLSchemaInput,
  GraphQLTypeDef,
} from "./graphql/graphql_types.js";

// async storage
export { asyncStorage } from "./plugins/async_local_storage/async_local_storage.js";

// Schema Cache Monitoring
export {
  clearAllCaches as clearAllSchemaCaches,
  getCacheMetrics as getSchemaCacheMetrics,
  logCacheMetrics as logSchemaCacheMetrics,
} from "./ajv/cache_monitor.js";
export type { CacheMetrics as SchemaCacheMetrics } from "./ajv/cache_monitor.js";

// Storage
export {
  AzureBlobStorageProvider,
  type BlobStorageProviderOptions,
} from "./storage/providers/blob_storage.js";
export {
  LocalStorageProvider,
  type LocalStorageProviderOptions,
} from "./storage/providers/local.js";
export {
  S3StorageProvider,
  type S3StorageProviderOptions,
} from "./storage/providers/s3.js";
export { Storage } from "./storage/storage.js";
export type {
  BaseStorageProviderOptions,
  CustomStorageProviderOptions,
  StorageInterface,
  StorageOptions,
  StorageProviderOptions,
} from "./storage/storage_types.js";

// Mailer
export {
  CustomAdapter,
  EjsAdapter,
  HandlebarsAdapter,
  MustacheAdapter,
  EdgeAdapter,
} from "./mailer/adapters/index.js";
export { MailOptionsBuilder } from "./mailer/mail_options_builder.js";
export { MailProvider } from "./mailer/mail_provider.js";
export { Mailer } from "./mailer/mailer.js";
export type {
  MailerInterface,
  MailerOptions,
  MailerProviderOptions,
  MailOptions,
  MailProviderInterface,
  TemplateMailOptions,
} from "./mailer/mailer_types.js";

// Plugins
export { asyncLocalStorage } from "./plugins/async_local_storage/async_local_storage.js";
export type { AsyncLocalStorageContextSetters } from "./plugins/async_local_storage/async_local_storage_types.js";
export { BasePlugin } from "./plugins/base_plugin.js";
export { compression } from "./plugins/compression/compression.js";
export type { CompressionOptions } from "./plugins/compression/compression_types.js";
export { cookie } from "./plugins/cookie/cookie.js";
export type { CookieMiddlewareOptions } from "./plugins/cookie/cookie_types.js";
export { cors } from "./plugins/cors/cors.js";
export type { CorsOptions } from "./plugins/cors/cors_types.js";
export {
  createExpressAdapter,
  expressMiddleware,
  mountExpressRouter,
  expressHandler,
} from "./plugins/express/express.js";
export { helmet } from "./plugins/helmet/helmet.js";
export type { HelmetOptions } from "./plugins/helmet/helmet_types.js";
export { log } from "./plugins/log/log.js";
export type { LogOptions } from "./plugins/log/log_types.js";
export { methodOverride } from "./plugins/method_override/method_override.js";
export type { MethodOverrideOptions } from "./plugins/method_override/method_override_types.js";
export { rateLimiter } from "./plugins/rate_limiter/rate_limiter.js";
export type { RateLimiterKeyOptions } from "./plugins/rate_limiter/rate_limiter_types.js";
export { session } from "./plugins/session/session.js";
export type { SessionOptions } from "./plugins/session/session_types.js";
export { serveStatic } from "./plugins/static/static.js";
export type { StaticPluginOptions } from "./plugins/static/static_types.js";
export { timeout as timeoutMw } from "./plugins/timeout/timeout.js";
export type { TimeoutOptions } from "./plugins/timeout/timeout_types.js";
export { trustProxy } from "./plugins/trust_proxy/trust_proxy.js";
export type { TrustProxyOptions } from "./plugins/trust_proxy/trust_proxy_types.js";

// Policy
export { createPolicyDecorator } from "./server/policy/policy_decorator.js";
export { PolicyManager } from "./server/policy/policy_manager.js";
export type {
  PolicyDecorator,
  PolicyProvider,
} from "./server/policy/policy_types.js";

// Router
import { router as routerInstance } from "./server/router/router.js";
import type { ClientRouter } from "./server/router/router_type.js";
/**
 * Singleton main router instance that handles all route registrations inside the balda server
 */
export const router = routerInstance as ClientRouter;

export default Server;
