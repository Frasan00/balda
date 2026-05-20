import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";

export type CompressionOptions = {
  /**
   * Minimum response size in bytes to trigger compression
   * Default: 1024 (1KB)
   */
  threshold?: number;

  /**
   * Compression level (0-9)
   * 0 = no compression, 9 = maximum compression
   * Default: 6
   */
  level?: number;

  /**
   * Content types to compress (regex patterns)
   * Default: common compressible types (text, json, xml, javascript, etc.)
   */
  filter?: RegExp[];

  /**
   * Optional predicate to opt out of compression for specific requests/responses.
   * Return true to skip compression (e.g. for sensitive endpoints to mitigate BREACH).
   */
  skipFor?: (req: Request, res: Response) => boolean;
};
