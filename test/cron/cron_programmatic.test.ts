import { beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "../../src/cron/cron.js";
import { cron } from "../../src/cron/cron_factory.js";

describe("cron() programmatic API", () => {
  beforeEach(() => {
    CronService.scheduledJobs = [];
  });

  it("returns a handle with name, start, stop and destroy", () => {
    const handle = cron("* * * * *", { name: "cleanup" });
    expect(handle).toHaveProperty("name", "cleanup");
    expect(typeof handle.start).toBe("function");
    expect(typeof handle.stop).toBe("function");
    expect(typeof handle.destroy).toBe("function");
  });

  it("can be used as a decorator and registers with CronService", () => {
    class Cleanup {
      @cron("0 0 * * *")
      run() {
        return;
      }
    }

    expect(CronService.scheduledJobs.length).toBe(1);
    expect(CronService.scheduledJobs[0].name).toBe("Cleanup.run");
  });

  it("uses the provided name in the decorator form", () => {
    class Cleanup {
      @cron("0 0 * * *", { name: "named-cleanup" })
      run() {
        return;
      }
    }

    expect(CronService.scheduledJobs[0].name).toBe("named-cleanup");
  });

  it("starts a job that actually executes the handler on schedule", async () => {
    const spy = vi.fn();
    const handle = cron("* * * * * *", { name: "spy-job" });

    await handle.start(spy);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(spy).toHaveBeenCalled();
    handle.destroy();
  });

  it("throws when starting the same job twice", async () => {
    const handle = cron("* * * * *", { name: "twice" });
    await handle.start(() => {});

    await expect(handle.start(() => {})).rejects.toThrow(
      'Cron job "twice" is already started',
    );
    handle.destroy();
  });

  it("stop() makes the job schedulable again", async () => {
    const handle = cron("* * * * *", { name: "restart" });
    await handle.start(() => {});
    handle.stop();

    await expect(handle.start(() => {})).resolves.toBeUndefined();
    handle.destroy();
  });
});
