import type { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import { ClientNotFoundError } from "../../../errors/client_not_found_error.js";
import { PGBossConfiguration } from "./pgboss_configuration.js";
import type {
  GenericPubSub,
  PGBossQueueOptions,
  PGBossSendOptions,
  PublishOptions,
} from "../../queue_types.js";

export class PGBossPubSub implements GenericPubSub {
  declare private boss: PgBoss;
  private createdQueues: Set<string> = new Set();

  async publish<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"pgboss">,
  ): Promise<{ id: string }> {
    const boss = await this.getBoss();
    await this.ensureQueue(topic);
    const sendOptions = (options || {}) as PGBossSendOptions;
    const id = await boss.send(topic, payload as object, sendOptions);
    return { id: String(id ?? "") };
  }

  async subscribe<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
  ): Promise<void> {
    const boss = await this.getBoss();
    await this.ensureQueue(topic);
    const options = PGBossConfiguration.options;
    if (options.errorHandler) {
      boss.on("error", options.errorHandler);
    }

    await boss.work(topic, async (job: Job<unknown> | Job<unknown>[]) => {
      const jobs = Array.isArray(job) ? job : [job];
      for (const j of jobs) {
        await handler(j.data as TPayload);
      }
    });
  }

  private async getBoss(): Promise<PgBoss> {
    if (this.boss) {
      return this.boss;
    }

    const mod = await import("pg-boss").catch(() => {
      throw new ClientNotFoundError("pg-boss", "pg");
    });

    type PGBossCtor = new (config?: unknown) => PgBoss;
    const maybeDefault = (mod.PgBoss as { default?: PGBossCtor }).default;
    const Ctor: PGBossCtor =
      maybeDefault ?? (mod.PgBoss as unknown as PGBossCtor);

    const { connectionString, boss } = PGBossConfiguration.options;
    const arg = connectionString ?? boss;
    const instance = new Ctor(arg);

    if (PGBossConfiguration.options?.errorHandler) {
      instance.on("error", PGBossConfiguration.options.errorHandler);
    }

    await instance.start();
    this.boss = instance;
    return this.boss;
  }

  private async ensureQueue(topic: string): Promise<void> {
    if (this.createdQueues.has(topic)) {
      return;
    }

    const pgBoss = await this.getBoss();
    if (typeof pgBoss.createQueue === "function") {
      await pgBoss.createQueue(topic);
    }

    this.createdQueues.add(topic);
  }

  // Methods for TypedQueue with per-queue config
  async publishWithConfig<TPayload>(
    topic: string,
    payload: TPayload,
    options?: PublishOptions<"pgboss">,
    queueConfig?: PGBossQueueOptions,
  ): Promise<{ id: string }> {
    const boss = await this.getBossWithConfig(queueConfig);
    await this.ensureQueueWithBoss(topic, boss);
    const sendOptions = (options || {}) as PGBossSendOptions;
    const id = await boss.send(topic, payload as object, sendOptions);
    return { id: String(id ?? "") };
  }

  async subscribeWithConfig<TPayload>(
    topic: string,
    handler: (payload: TPayload) => Promise<void>,
    queueConfig?: PGBossQueueOptions,
  ): Promise<void> {
    const boss = await this.getBossWithConfig(queueConfig);
    await this.ensureQueueWithBoss(topic, boss);
    const globalOptions = PGBossConfiguration.options;
    if (globalOptions.errorHandler) {
      boss.on("error", globalOptions.errorHandler);
    }

    await boss.work(topic, async (job: Job<unknown> | Job<unknown>[]) => {
      const jobs = Array.isArray(job) ? job : [job];
      for (const j of jobs) {
        await handler(j.data as TPayload);
      }
    });
  }

  private bossInstances: Map<string, PgBoss> = new Map();

  private async getBossWithConfig(
    queueConfig?: PGBossQueueOptions,
  ): Promise<PgBoss> {
    // If no custom config, use the default boss
    if (!queueConfig?.connectionString) {
      return this.getBoss();
    }

    const configKey = queueConfig.connectionString;
    if (this.bossInstances.has(configKey)) {
      return this.bossInstances.get(configKey)!;
    }

    const mod = await import("pg-boss").catch(() => {
      throw new ClientNotFoundError("pg-boss", "pg");
    });

    type PGBossCtor = new (config?: unknown) => PgBoss;
    const maybeDefault = (mod.PgBoss as { default?: PGBossCtor }).default;
    const Ctor: PGBossCtor =
      maybeDefault ?? (mod.PgBoss as unknown as PGBossCtor);

    const instance = new Ctor(queueConfig.connectionString);

    if (PGBossConfiguration.options?.errorHandler) {
      instance.on("error", PGBossConfiguration.options.errorHandler);
    }

    await instance.start();
    this.bossInstances.set(configKey, instance);
    return instance;
  }

  private async ensureQueueWithBoss(
    topic: string,
    boss: PgBoss,
  ): Promise<void> {
    if (this.createdQueues.has(topic)) {
      return;
    }

    if (typeof boss.createQueue === "function") {
      await boss.createQueue(topic);
    }

    this.createdQueues.add(topic);
  }
}
