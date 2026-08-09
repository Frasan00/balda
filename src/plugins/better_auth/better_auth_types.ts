/**
 * Options for `mountBetterAuth`.
 */
export type BetterAuthMountOptions = {
  /**
   * Overrides the mount path. Defaults to `auth.options.basePath ?? "/api/auth"`.
   */
  basePath?: string;
};
