import { describe, expect, it } from "vitest";
import { BaseCron } from "../../src/cron/base_cron.js";

describe("BaseCron", () => {
  it("should provide logger instance to subclasses", () => {
    class TestCron extends BaseCron {}

    const cron = new TestCron();
    expect(cron["logger"]).toBeDefined();
    expect(cron["logger"]).toHaveProperty("info");
    expect(cron["logger"]).toHaveProperty("error");
    expect(cron["logger"]).toHaveProperty("warn");
    expect(cron["logger"]).toHaveProperty("debug");
  });

  it("should set logger scope to class name", () => {
    class DailyReportCron extends BaseCron {}

    const cron = new DailyReportCron();
    const logger = cron["logger"];

    expect(logger.bindings()).toHaveProperty("scope", "DailyReportCron");
  });

  it("should provide isolated logger for each subclass", () => {
    class CronA extends BaseCron {}
    class CronB extends BaseCron {}

    const cronA = new CronA();
    const cronB = new CronB();

    const loggerA = cronA["logger"];
    const loggerB = cronB["logger"];

    expect(loggerA.bindings().scope).toBe("CronA");
    expect(loggerB.bindings().scope).toBe("CronB");
    expect(loggerA).not.toBe(loggerB);
  });

  it("should allow logger usage in cron handler methods", async () => {
    class DataSyncCron extends BaseCron {
      async syncData() {
        this.logger.info("Starting data sync");
        return "synced";
      }
    }

    const cron = new DataSyncCron();
    const result = await cron.syncData();

    expect(result).toBe("synced");
  });

  it("should be extendable with custom properties", () => {
    class CustomCron extends BaseCron {
      private readonly interval = 5000;
      private retries = 3;

      getInterval() {
        return this.interval;
      }

      getRetries() {
        return this.retries;
      }

      decrementRetries() {
        this.retries--;
      }
    }

    const cron = new CustomCron();
    expect(cron.getInterval()).toBe(5000);
    expect(cron.getRetries()).toBe(3);

    cron.decrementRetries();
    expect(cron.getRetries()).toBe(2);

    expect(cron["logger"]).toBeDefined();
  });

  it("should support methods with parameters", () => {
    class ProcessingCron extends BaseCron {
      processItems(items: string[]) {
        this.logger.info({ count: items.length }, "Processing items");
        return items.map((item) => item.toUpperCase());
      }
    }

    const cron = new ProcessingCron();
    const result = cron.processItems(["test", "data"]);

    expect(result).toEqual(["TEST", "DATA"]);
  });

  it("should support async methods", async () => {
    class AsyncCron extends BaseCron {
      async fetchData() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        this.logger.info("Data fetched");
        return { success: true };
      }
    }

    const cron = new AsyncCron();
    const result = await cron.fetchData();

    expect(result).toEqual({ success: true });
  });

  it("should maintain separate instances", () => {
    class CounterCron extends BaseCron {
      private count = 0;

      increment() {
        this.count++;
        return this.count;
      }

      getCount() {
        return this.count;
      }
    }

    const cron1 = new CounterCron();
    const cron2 = new CounterCron();

    cron1.increment();
    cron1.increment();
    cron2.increment();

    expect(cron1.getCount()).toBe(2);
    expect(cron2.getCount()).toBe(1);
  });

  it("should support constructor parameters", () => {
    class ConfigurableCron extends BaseCron {
      constructor(
        private readonly config: { maxRetries: number; timeout: number },
      ) {
        super();
      }

      getConfig() {
        return this.config;
      }
    }

    const cron = new ConfigurableCron({ maxRetries: 5, timeout: 3000 });
    expect(cron.getConfig()).toEqual({ maxRetries: 5, timeout: 3000 });
    expect(cron["logger"]).toBeDefined();
  });

  it("should allow protected logger access in subclass", () => {
    class LoggingCron extends BaseCron {
      logMessage(message: string) {
        this.logger.info(message);
        return true;
      }
    }

    const cron = new LoggingCron();
    expect(cron.logMessage("test")).toBe(true);
  });
});
