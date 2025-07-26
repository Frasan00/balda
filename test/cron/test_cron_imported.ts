import { cron } from "src/index";

export class TestCron {
  @cron("*/2 * * * * *")
  testImported() {
    console.log("test imported");
  }
}
