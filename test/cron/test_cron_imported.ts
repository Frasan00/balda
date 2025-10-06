import { cron } from "../../src/cron/decorator/cron_decorator";

export class TestCron {
  @cron("*/2 * * * * *")
  testImported() {
    console.log("test imported");
  }
}
