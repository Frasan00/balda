import { server } from "test/server/instance";
import "./test_cron_imported";

server.startRegisteredCrons(["./test/cron/test_cron.ts"], () => {
  console.log("cron started");
});
