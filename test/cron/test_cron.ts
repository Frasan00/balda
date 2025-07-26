import { cron } from "src/index";

export class TestCron {
  @cron("*/2 * * * * *")
  test() {
    console.log("test");
  }
}
