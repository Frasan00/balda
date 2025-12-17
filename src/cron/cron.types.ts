import type { schedule } from "node-cron";

export type CronSchedule = {
  name: string;
  args: Parameters<typeof schedule>;
};
export type CronScheduleParams = Parameters<typeof schedule>;

export type CronUIOptions = {
  path: string;
};
