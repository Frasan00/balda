import { afterEach, describe, expect, it, vi } from "vitest";
import { CronService } from "../../src/cron/cron.js";
import { Server } from "../../src/index.js";

describe("Server background cron bootstrap", () => {
  afterEach(async () => {
    CronService.scheduledJobs = [];
  });

  it("schedules cron jobs declared in the background option on bootstrap", async () => {
    const spy = vi.fn();
    const server = new Server({
      background: {
        crons: [
          {
            schedule: "* * * * * *",
            options: { name: "server-cron" },
            handler: spy,
          },
        ],
      },
    });

    // Trigger bootstrap (importControllers + startBackgroundServices) via inject
    await server.inject.get("/").catch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(spy).toHaveBeenCalled();
  });
});
