import { CronService } from "../../src/cron/cron.js";
import "./test_cron_imported.js";

// Import cron jobs from glob patterns
await CronService.massiveImportCronJobs(["test/cron/test_cron.ts"]);

// Start the cron scheduler
await CronService.run();

console.log("Cron started");
