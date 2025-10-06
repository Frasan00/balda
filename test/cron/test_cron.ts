import { cron } from "../../src/cron/decorator/cron_decorator";

export class TestCron {
  @cron("*/2 * * * * *")
  test() {
    console.log("test");
  }
}
