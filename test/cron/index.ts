import { startRegisteredCrons } from "src/index";
import "./test_cron_imported";

startRegisteredCrons(["./test/cron/test_cron.ts"], () => {
  console.log("cron started");
});
