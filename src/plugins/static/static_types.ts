export type StaticPluginOptions = {
  /**
   * The file system directory path where the assets are located
   * @example "./tmp/assets" or "public"
   */
  source: string;
  /**
   * The URL path where the assets will be served
   * @example "/assets" or "/public"
   */
  path: string;
};
