import { cron } from "../../src/cron/decorator/cron_decorator.js";

export class TestCron {
  @cron("*/2 * * * * *")
  test() {
    console.log("test");
  }
}
