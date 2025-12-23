import { beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "../../src/cron/cron.js";
import { cron } from "../../src/cron/decorator/cron_decorator.js";

describe("@cron decorator", () => {
  beforeEach(() => {
    CronService.scheduledJobs = [];
  });

  describe("basic usage", () => {
    it("should register method as cron job", () => {
      class TestCron {
        @cron("* * * * *")
        async handle() {
          return "executed";
        }
      }

      expect(CronService.scheduledJobs.length).toBe(1);
      expect(CronService.scheduledJobs[0].name).toBe("TestCron.handle");
    });

    it("should preserve method descriptor", async () => {
      class TestCron {
        @cron("0 0 * * *")
        async dailyTask() {
          return "daily";
        }
      }

      const instance = new TestCron();
      const result = await instance.dailyTask();
      expect(result).toBe("daily");
    });

    it("should register with correct schedule expression", () => {
      class TestCron {
        @cron("*/5 * * * *")
        async everyFiveMinutes() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("*/5 * * * *");
    });
  });

  describe("with options", () => {
    it("should register cron job with timezone option", () => {
      class TestCron {
        @cron("0 9 * * *", { timezone: "Europe/London" })
        async morningTask() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[2]).toHaveProperty("timezone", "Europe/London");
    });

    it("should register cron job with name in options", () => {
      class TestCron {
        @cron("0 0 * * *", {})
        async namedTask() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[2]).toHaveProperty("name", "TestCron.namedTask");
    });

    it("should register cron job with timezone option", () => {
      class TestCron {
        @cron("0 12 * * *", {
          timezone: "America/New_York",
        })
        async noonTask() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[2]).toHaveProperty("timezone", "America/New_York");
      expect(job.args[2]).toHaveProperty("name", "TestCron.noonTask");
    });
  });

  describe("multiple decorators", () => {
    it("should register multiple cron jobs in same class", () => {
      class MultiCron {
        @cron("0 0 * * *")
        async dailyTask() {
          return "daily";
        }

        @cron("0 * * * *")
        async hourlyTask() {
          return "hourly";
        }

        @cron("* * * * *")
        async minuteTask() {
          return "minute";
        }
      }

      expect(CronService.scheduledJobs.length).toBe(3);
      expect(CronService.scheduledJobs[0].name).toBe("MultiCron.dailyTask");
      expect(CronService.scheduledJobs[1].name).toBe("MultiCron.hourlyTask");
      expect(CronService.scheduledJobs[2].name).toBe("MultiCron.minuteTask");
    });

    it("should register cron jobs from multiple classes", () => {
      class CronA {
        @cron("0 0 * * *")
        async taskA() {
          return;
        }
      }

      class CronB {
        @cron("0 12 * * *")
        async taskB() {
          return;
        }
      }

      expect(CronService.scheduledJobs.length).toBe(2);
      expect(CronService.scheduledJobs[0].name).toBe("CronA.taskA");
      expect(CronService.scheduledJobs[1].name).toBe("CronB.taskB");
    });
  });

  describe("handler execution", () => {
    it("should execute handler with new instance", async () => {
      const spy = vi.fn();

      class TestCron {
        @cron("* * * * *")
        async handle() {
          spy();
        }
      }

      const job = CronService.scheduledJobs[0];
      await (job.args[1] as Function)();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should create new instance for each execution", async () => {
      const constructorSpy = vi.fn();

      class TestCron {
        constructor() {
          constructorSpy();
        }

        @cron("* * * * *")
        async handle() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      await (job.args[1] as Function)();
      await (job.args[1] as Function)();

      expect(constructorSpy).toHaveBeenCalledTimes(2);
    });

    it("should pass through return value", async () => {
      class TestCron {
        @cron("* * * * *")
        async handle() {
          return "result";
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBe("result");
    });

    it("should handle async methods", async () => {
      class TestCron {
        @cron("* * * * *")
        async asyncHandle() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "async-result";
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBe("async-result");
    });

    it("should propagate errors from handler", async () => {
      class TestCron {
        @cron("* * * * *")
        async errorHandle() {
          throw new Error("Handler error");
        }
      }

      const job = CronService.scheduledJobs[0];

      await expect((job.args[1] as Function)()).rejects.toThrow(
        "Handler error",
      );
    });
  });

  describe("schedule expressions", () => {
    it("should support second-level cron expressions", () => {
      class TestCron {
        @cron("*/30 * * * * *")
        async everyThirtySeconds() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("*/30 * * * * *");
    });

    it("should support minute-level cron expressions", () => {
      class TestCron {
        @cron("*/15 * * * *")
        async everyFifteenMinutes() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("*/15 * * * *");
    });

    it("should support hour-level cron expressions", () => {
      class TestCron {
        @cron("0 */2 * * *")
        async everyTwoHours() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("0 */2 * * *");
    });

    it("should support day-level cron expressions", () => {
      class TestCron {
        @cron("0 0 * * 0")
        async weekly() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("0 0 * * 0");
    });

    it("should support complex cron expressions", () => {
      class TestCron {
        @cron("0 0 1 * *")
        async firstDayOfMonth() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[0]).toBe("0 0 1 * *");
    });
  });

  describe("class context", () => {
    it("should maintain correct this context", async () => {
      class TestCron {
        private value = "test-value";

        @cron("* * * * *")
        async handle() {
          return this.value;
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBe("test-value");
    });

    it("should allow access to class properties", async () => {
      class TestCron {
        private count = 0;

        @cron("* * * * *")
        async increment() {
          this.count++;
          return this.count;
        }
      }

      const job = CronService.scheduledJobs[0];
      const result1 = await (job.args[1] as Function)();
      const result2 = await (job.args[1] as Function)();

      expect(result1).toBe(1);
      expect(result2).toBe(1);
    });

    it("should allow calling other methods", async () => {
      class TestCron {
        private helper() {
          return "helper-result";
        }

        @cron("* * * * *")
        async handle() {
          return this.helper();
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBe("helper-result");
    });
  });

  describe("edge cases", () => {
    it("should handle methods with no return value", async () => {
      class TestCron {
        @cron("* * * * *")
        async handleNoReturn() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBeUndefined();
    });

    it("should handle synchronous methods", async () => {
      class TestCron {
        @cron("* * * * *")
        handleSync() {
          return "sync-result";
        }
      }

      const job = CronService.scheduledJobs[0];
      const result = await (job.args[1] as Function)();

      expect(result).toBe("sync-result");
    });

    it("should work with methods that throw errors", async () => {
      class TestCron {
        @cron("* * * * *")
        async throwError() {
          throw new Error("Expected error");
        }
      }

      const job = CronService.scheduledJobs[0];

      await expect((job.args[1] as Function)()).rejects.toThrow(
        "Expected error",
      );
    });

    it("should handle empty options object", () => {
      class TestCron {
        @cron("* * * * *", {})
        async handle() {
          return;
        }
      }

      const job = CronService.scheduledJobs[0];
      expect(job.args[2]).toBeDefined();
      expect(job.args[2]).toHaveProperty("name", "TestCron.handle");
    });
  });
});
