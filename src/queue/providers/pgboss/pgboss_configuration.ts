import type { SyncOrAsync } from "src/type_util";

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
