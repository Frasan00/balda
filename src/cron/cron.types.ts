import type nodeCron from "node-cron";

export type CronSchedule = {
  name: string;
  args: Parameters<typeof nodeCron.schedule>;
};
export type CronScheduleParams = Parameters<typeof nodeCron.schedule>;
