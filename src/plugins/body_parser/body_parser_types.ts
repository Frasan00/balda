import type { FilePluginOptions } from "./file/file_types.js";
import type { JsonOptions } from "./json/json_options.js";
import type { UrlEncodedOptions } from "./urlencoded/urlencoded_types.js";

export type BodyParserOptions = {
  json?: JsonOptions;
  urlencoded?: UrlEncodedOptions;
  fileParser?: FilePluginOptions;
};
