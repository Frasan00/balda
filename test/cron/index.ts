import { server } from "../server/instance.js";
import "./test_cron_imported.js";

server.startRegisteredCrons(["./test/cron/test_cron.ts"], () => {
  console.log("cron started");
});
