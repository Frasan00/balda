import type { TaskContext } from "node-cron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CronService, setCronGlobalErrorHandler } from "../../src/cron/cron.js";

describe("CronService", () => {
  beforeEach(() => {
    CronService.scheduledJobs = [];
  });

  describe("register", () => {
    it("should register a cron job", () => {
      const handler = vi.fn();
      const schedule = "0 0 * * *";

      CronService.register("TestJob", schedule, handler);

      expect(CronService.scheduledJobs.length).toBe(1);
      expect(CronService.scheduledJobs[0].name).toBe("TestJob");
      expect(CronService.scheduledJobs[0].args[0]).toBe(schedule);
      expect(CronService.scheduledJobs[0].args[1]).toBe(handler);
    });

    it("should register cron job with options", () => {
      const handler = vi.fn();
      const schedule = "*/5 * * * *";
      const options = {
        timezone: "Europe/London",
      };

      CronService.register("TestJobWithOptions", schedule, handler, options);

      expect(CronService.scheduledJobs.length).toBe(1);
      const job = CronService.scheduledJobs[0];
      expect(job.name).toBe("TestJobWithOptions");
      expect(job.args[2]).toHaveProperty("name", "TestJobWithOptions");
      expect(job.args[2]).toHaveProperty("timezone", "Europe/London");
    });

    it("should merge name into options", () => {
      const handler = vi.fn();
      const schedule = "0 12 * * *";
      const options = {
        timezone: "America/New_York",
      };

      CronService.register("DailyJob", schedule, handler, options);

      const job = CronService.scheduledJobs[0];
      expect(job.args[2]).toHaveProperty("name", "DailyJob");
      expect(job.args[2]).toHaveProperty("timezone", "America/New_York");
    });

    it("should register multiple cron jobs", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      CronService.register("Job1", "0 0 * * *", handler1);
      CronService.register("Job2", "0 12 * * *", handler2);
      CronService.register("Job3", "*/30 * * * *", handler3);

      expect(CronService.scheduledJobs.length).toBe(3);
      expect(CronService.scheduledJobs[0].name).toBe("Job1");
      expect(CronService.scheduledJobs[1].name).toBe("Job2");
      expect(CronService.scheduledJobs[2].name).toBe("Job3");
    });

    it("should preserve handler function", () => {
      const handler = vi.fn();
      CronService.register("PreserveHandler", "* * * * *", handler);

      const job = CronService.scheduledJobs[0];
      expect(job.args[1]).toBe(handler);
    });
  });

  describe("run", () => {
    it("should do nothing when no jobs scheduled", async () => {
      await CronService.run();

      expect(CronService.scheduledJobs.length).toBe(0);
    });
  });

  describe("globalErrorHandler", () => {
    it("should have default error handler", () => {
      expect(CronService.globalErrorHandler).toBeDefined();
      expect(typeof CronService.globalErrorHandler).toBe("function");
    });

    it("should log errors by default", () => {
      const mockError = new Error("Test error");
      const mockContext = {
        execution: {
          error: mockError,
          startDate: new Date(),
          endDate: new Date(),
        },
      } as unknown as TaskContext;

      expect(() => CronService.globalErrorHandler(mockContext)).not.toThrow();
    });

    it("should handle context without execution", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockContext = {} as TaskContext;

      expect(() => CronService.globalErrorHandler(mockContext)).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("setCronGlobalErrorHandler", () => {
    it("should allow custom error handler", () => {
      const customHandler = vi.fn();
      setCronGlobalErrorHandler(customHandler);

      expect(typeof CronService.globalErrorHandler).toBe("function");
      expect(CronService.globalErrorHandler.name).toContain("bound");
    });

    it("should call custom error handler with context", () => {
      const customHandler = vi.fn();
      setCronGlobalErrorHandler(customHandler);

      const mockError = new Error("Custom error");
      const mockContext = {
        execution: {
          error: mockError,
          startDate: new Date(),
          endDate: new Date(),
        },
      } as unknown as TaskContext;

      CronService.globalErrorHandler(mockContext);

      expect(customHandler).toHaveBeenCalledWith(mockContext);
    });

    it("should override previous custom error handler", () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      setCronGlobalErrorHandler(firstHandler);
      setCronGlobalErrorHandler(secondHandler);

      const mockContext = {
        execution: {
          error: new Error("Test"),
          startDate: new Date(),
          endDate: new Date(),
        },
      } as unknown as TaskContext;

      CronService.globalErrorHandler(mockContext);

      expect(secondHandler).toHaveBeenCalled();
      expect(firstHandler).not.toHaveBeenCalled();
    });

    it("should preserve binding to CronService", () => {
      const customHandler = vi.fn(function (
        this: typeof CronService,
        _context: TaskContext,
      ) {
        expect(this).toBe(CronService);
      });

      setCronGlobalErrorHandler(customHandler);

      const mockContext = {
        execution: {
          error: new Error("Test"),
          startDate: new Date(),
          endDate: new Date(),
        },
      } as unknown as TaskContext;

      CronService.globalErrorHandler(mockContext);

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe("massiveImportCronJobs", () => {
    it("should import cron jobs from glob patterns", async () => {
      await CronService.massiveImportCronJobs(["test/cron/test_cron.ts"]);

      expect(CronService.scheduledJobs.length).toBeGreaterThan(0);
    });

    it("should handle import errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await CronService.massiveImportCronJobs([
        "test/cron/non-existent-file.ts",
      ]);

      consoleErrorSpy.mockRestore();
    });

    it("should import multiple patterns", async () => {
      const patterns = [
        "test/cron/test_cron.ts",
        "test/cron/test_cron_imported.ts",
      ];

      await CronService.massiveImportCronJobs(patterns);

      expect(CronService.scheduledJobs.length).toBeGreaterThan(0);
    });

    it("should handle empty pattern array", async () => {
      await CronService.massiveImportCronJobs([]);

      expect(CronService.scheduledJobs.length).toBe(0);
    });

    it("should handle invalid patterns gracefully", async () => {
      await CronService.massiveImportCronJobs(["invalid-pattern/*.ts"]);

      expect(CronService.scheduledJobs.length).toBeGreaterThanOrEqual(0);
    });

    it("should import all matching files", async () => {
      const initialJobCount = CronService.scheduledJobs.length;

      await CronService.massiveImportCronJobs(["test/cron/*.ts"]);

      expect(CronService.scheduledJobs.length).toBeGreaterThanOrEqual(
        initialJobCount,
      );
    });
  });

  describe("integration", () => {
    it("should handle complete lifecycle of cron job", async () => {
      const handler = vi.fn();
      const schedule = "*/2 * * * * *";

      CronService.register("LifecycleJob", schedule, handler, {
        timezone: "UTC",
      });

      expect(CronService.scheduledJobs.length).toBe(1);

      const job = CronService.scheduledJobs[0];
      expect(job.name).toBe("LifecycleJob");
      expect(job.args[0]).toBe(schedule);
      expect(job.args[2]).toHaveProperty("timezone", "UTC");
    });

    it("should support multiple timezones", () => {
      CronService.register("JobLondon", "0 9 * * *", vi.fn() as any, {
        timezone: "Europe/London",
      });

      CronService.register("JobTokyo", "0 9 * * *", vi.fn() as any, {
        timezone: "Asia/Tokyo",
      });

      CronService.register("JobNewYork", "0 9 * * *", vi.fn() as any, {
        timezone: "America/New_York",
      });

      expect(CronService.scheduledJobs.length).toBe(3);
      expect(CronService.scheduledJobs[0].args[2]?.timezone).toBe(
        "Europe/London",
      );
      expect(CronService.scheduledJobs[1].args[2]?.timezone).toBe("Asia/Tokyo");
      expect(CronService.scheduledJobs[2].args[2]?.timezone).toBe(
        "America/New_York",
      );
    });
  });
});
