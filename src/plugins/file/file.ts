import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileTooLargeError } from "../../errors/errors_constants";
import type {
  FilePluginOptions,
  FormFile,
} from "../../plugins/file/file_types";
import { nativeFs } from "../../runtime/native_fs";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

/**
 * Middleware to handle multipart/form-data file uploads.
 *  - Validates each file against the given `FilePluginOptions` (currently only size limit).
 *  - Stores every uploaded file in a runtime-agnostic temporary directory and exposes them via `req.files` & `req.file`.
 *  - Cleans the temporary files both after successful handler execution and when an unhandled error bubbles up.
 *  - Can be used both as a global middleware to check all incoming requests for files and as a route middleware to check only the files for a specific route
 */
export const fileParser = (
  options?: FilePluginOptions
): ServerRouteMiddleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tmpPaths: string[] = [];
    try {
      const contentType =
        req.headers.get("content-type") ?? req.headers.get("Content-Type");
      if (!contentType || !contentType.startsWith("multipart/form-data")) {
        return next();
      }

      if (!req.rawBody) {
        return next();
      }

      const boundaryMatch = contentType.match(/boundary=(.*)(;|$)/i);
      if (!boundaryMatch) {
        return next();
      }

      const boundary = boundaryMatch[1].replace(/(^\s*"?|"?\s*$)/g, "");

      const bodyBuf = new Uint8Array(req.rawBody);
      const boundaryBuf = new TextEncoder().encode(`--${boundary}`);
      const CRLFCRLF = new Uint8Array([13, 10, 13, 10]);

      const parts: Array<{ headers: string; data: Uint8Array }> = [];

      const indexOfSub = (
        haystack: Uint8Array,
        needle: Uint8Array,
        from: number = 0
      ): number => {
        outer: for (let i = from; i <= haystack.length - needle.length; i++) {
          for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) continue outer;
          }
          return i;
        }

        return -1;
      };

      let start = indexOfSub(bodyBuf, boundaryBuf);
      while (start !== -1) {
        start += boundaryBuf.length;

        if (bodyBuf[start] === 45 && bodyBuf[start + 1] === 45) {
          break;
        }

        if (bodyBuf[start] === 13 && bodyBuf[start + 1] === 10) {
          start += 2;
        }

        const headerEnd = indexOfSub(bodyBuf, CRLFCRLF, start);
        if (headerEnd === -1) {
          break;
        }

        const headersBuf = bodyBuf.subarray(start, headerEnd);
        const headers = new TextDecoder().decode(headersBuf);

        const dataStart = headerEnd + CRLFCRLF.length;
        const nextBoundary = indexOfSub(bodyBuf, boundaryBuf, dataStart);
        if (nextBoundary === -1) {
          break;
        }

        let dataEnd = nextBoundary - 1;
        if (bodyBuf[dataEnd] === 10) {
          dataEnd--;
        }

        if (bodyBuf[dataEnd] === 13) {
          dataEnd--;
        }

        const data = bodyBuf.subarray(dataStart, dataEnd + 1);
        parts.push({ headers, data });
        start = nextBoundary;
      }

      const files: FormFile[] = [];
      const fields: Record<string, string> = {};

      for (const part of parts) {
        const disposition = part.headers
          .split("\r\n")
          .find((h) => h.toLowerCase().startsWith("content-disposition:"));

        if (!disposition) {
          continue;
        }

        const formNameMatch = disposition.match(/name="([^"]+)"/);
        if (!formNameMatch) {
          continue;
        }
        const formName = formNameMatch[1];

        const filenameMatch = disposition.match(/filename="([^"]*)"/);
        const originalName = filenameMatch ? filenameMatch[1] : "";
        const isFile = Boolean(originalName);

        if (isFile) {
          if (options?.maxFileSize && part.data.length > options.maxFileSize) {
            return res
              .status(fileTooLargeError.status)
              .json({ error: fileTooLargeError.error });
          }

          const contentTypeHeader = part.headers
            .split("\r\n")
            .find((h) => h.toLowerCase().startsWith("content-type:"));

          const mimeType = contentTypeHeader
            ? contentTypeHeader.split(":")[1].trim()
            : "application/octet-stream";

          const extension = extname(originalName);
          const tmpPath = join(tmpdir(), `${randomString(10)}${extension}`);
          await nativeFs.writeFile(tmpPath, part.data);
          tmpPaths.push(tmpPath);

          files.push({
            formName,
            mimeType,
            size: part.data.length,
            tmpPath,
            originalName,
          });
        } else {
          fields[formName] = new TextDecoder().decode(part.data);
        }
      }

      req.files = files;

      await next();

      await cleanupTmpFiles(tmpPaths);
    } catch (error) {
      await cleanupTmpFiles(tmpPaths);
      throw error;
    }
  };
};

async function cleanupTmpFiles(paths: string[]) {
  await Promise.allSettled(paths.map((path) => nativeFs.unlink(path)));
}

function randomString(length: number) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}
