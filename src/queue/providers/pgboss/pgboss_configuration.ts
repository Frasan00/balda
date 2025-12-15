import type { SyncOrAsync } from "../../../type_util.js";

export type PGBossConfigurationOptions = {
  connectionString?: string;
  boss?: unknown;
  errorHandler?: (error: Error) => SyncOrAsync;
};

export class PGBossConfiguration {
  static options: PGBossConfigurationOptions = {};
}

export const definePGBossConfiguration = (
  options: PGBossConfigurationOptions,
): void => {
  PGBossConfiguration.options = options ?? {};
};
