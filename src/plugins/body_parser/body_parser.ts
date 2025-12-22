import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types.js";
import { canHaveBody } from "../../runtime/native_server/server_utils.js";
import type { NextFunction } from "../../server/http/next.js";
import type { Request } from "../../server/http/request.js";
import type { Response } from "../../server/http/response.js";
import { BodyParserOptions } from "./body_parser_types.js";
import { fileParser } from "./file/file.js";
import { json } from "./json/json.js";
import { urlencoded } from "./urlencoded/urlencoded.js";

const extractContentType = (req: Request): string | null => {
  const contentType =
    req.headers.get("content-type") ?? req.headers.get("Content-Type");
  return contentType?.split(";")[0] ?? null;
};

/**
 * Middleware to parse the body of the request. GET, DELETE and OPTIONS requests are not parsed. Used internally by the server. If no parser is set, the body will be parsed as raw array buffer.
 * @param options - The options for the body parser middleware.
 * @param options.json - The options for the JSON middleware.
 * @param options.urlencoded - The options for the URL-encoded middleware.
 * @param options.fileParser - The options for the file parser middleware.
 */
export const bodyParser = (
  options: BodyParserOptions,
): ServerRouteMiddleware => {
  const jsonOptions = options.json;
  const urlencodedOptions = options.urlencoded;
  const fileParserOptions = options.fileParser;

  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!canHaveBody(req.method)) {
      return next();
    }

    // Check if body has already been read to prevent "Body is unusable" error
    if (req.bodyUsed) {
      return next();
    }

    const contentType = extractContentType(req);
    if (contentType === "application/json" && jsonOptions) {
      return json(jsonOptions)(req, _res, next);
    }

    if (contentType === "multipart/form-data" && fileParserOptions) {
      return fileParser(fileParserOptions)(req, _res, next);
    }

    if (
      contentType === "application/x-www-form-urlencoded" &&
      urlencodedOptions
    ) {
      return urlencoded(urlencodedOptions)(req, _res, next);
    }

    // text
    if (contentType?.includes("text/")) {
      const decoder = new TextDecoder();
      const webRequest = req.toWebApi();
      req.body = decoder.decode(await webRequest.arrayBuffer());
      req.bodyUsed = true;
    }

    if (!req.body && !req.bodyUsed) {
      req.body = await req.toWebApi().arrayBuffer();
    }

    return next();
  };
};
