import type PgBoss from "pg-boss";
import type { Job } from "pg-boss";
import { ClientNotFoundError } from "src/errors/client_not_found_error";
import { PGBossConfiguration } from "src/queue/providers/pgboss/pgboss_configuration";
import type {
  PGBossSendOptions,
  PublishOptions,
  PubSub,
  QueueTopic,
  QueueTopicKey,
} from "src/queue/queue_types";

export class PGBossPubSub implements PubSub<"pgboss"> {
  declare private boss: PgBoss;
  private createdQueues: Set<string> = new Set();

  async publish<T extends QueueTopicKey>(
    topic: T,
    payload: QueueTopic[T],
    options?: PublishOptions<"pgboss">,
  ): Promise<{ id: string }> {
    const boss = await this.getBoss();
    await this.ensureQueue(String(topic));
    const sendOptions = (options || {}) as PGBossSendOptions;
    const id = await boss.send(String(topic), payload, sendOptions);
    return { id: String(id ?? "") };
  }

  async subscribe<T extends QueueTopicKey>(
    topic: T,
    handler: (payload: QueueTopic[T]) => Promise<void>,
  ): Promise<void> {
    const boss = await this.getBoss();
    await this.ensureQueue(String(topic));
    const options = PGBossConfiguration.options;
    if (options.errorHandler) {
      boss.on("error", options.errorHandler);
    }

    await boss.work(
      String(topic),
      async (job: Job<unknown> | Job<unknown>[]) => {
        const jobs = Array.isArray(job) ? job : [job];
        for (const job of jobs) {
          await handler(job.data as QueueTopic[T]);
        }
      },
    );
  }

  private async getBoss(): Promise<PgBoss> {
    if (this.boss) {
      return this.boss;
    }

    const mod = await import("pg-boss").catch(() => {
      throw new ClientNotFoundError("pg-boss", "pg");
    });

    type PGBossCtor = new (config?: unknown) => PgBoss;
    const maybeDefault = (mod as { default?: PGBossCtor }).default;
    const Ctor: PGBossCtor = maybeDefault ?? (mod as unknown as PGBossCtor);

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
}
