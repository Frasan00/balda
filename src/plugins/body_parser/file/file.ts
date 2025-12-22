import { BaldaError } from "../../../errors/balda_error.js";
import { errorFactory } from "../../../errors/error_factory.js";
import { FileTooLargeError } from "../../../errors/file_too_large.js";
import { nativeCrypto } from "../../../runtime/native_crypto.js";
import { nativeFs } from "../../../runtime/native_fs.js";
import { nativeOs } from "../../../runtime/native_os.js";
import { nativePath } from "../../../runtime/native_path.js";
import type { ServerRouteMiddleware } from "../../../runtime/native_server/server_types.js";
import type { NextFunction } from "../../../server/http/next.js";
import type { Request } from "../../../server/http/request.js";
import type { Response } from "../../../server/http/response.js";
import { parseSizeLimit } from "../../../utils.js";
import type { FilePluginOptions, FormFile } from "./file_types.js";

// 1MB in bytes for individual files
const DEFAULT_FILE_SIZE = 1024 * 1024;
// 10MB in bytes for total request
const DEFAULT_TOTAL_SIZE = 10 * 1024 * 1024;

/**
 * Middleware to handle multipart/form-data file uploads with security validations.
 */
export const fileParser = (
  options?: FilePluginOptions,
): ServerRouteMiddleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tmpPaths: string[] = [];
    try {
      const contentType =
        req.headers.get("content-type") ?? req.headers.get("Content-Type");

      if (!contentType || !contentType.startsWith("multipart/form-data")) {
        return next();
      }

      if (req.body || req.bodyUsed) {
        return next();
      }

      // Check Content-Length BEFORE reading body
      const contentLength = req.headers.get("content-length");
      const maxTotalSize =
        parseSizeLimit(options?.maxFileSize, DEFAULT_TOTAL_SIZE) ??
        DEFAULT_TOTAL_SIZE;

      if (contentLength && parseInt(contentLength) > maxTotalSize) {
        return res.status(413).json({
          error: "Payload too large",
          message: `Total request size exceeds ${maxTotalSize} bytes`,
        });
      }

      const boundaryMatch = contentType.match(/boundary=(.*)(;|$)/i);
      if (!boundaryMatch) {
        return next();
      }

      const boundary = boundaryMatch[1].replace(/(^\s*"?|"?\s*$)/g, "");

      const bodyBuf = new Uint8Array(await req.toWebApi().arrayBuffer());

      // Double-check actual body size
      if (bodyBuf.length > maxTotalSize) {
        return res.status(413).json({
          error: "Payload too large",
          message: `Total request size exceeds ${maxTotalSize} bytes`,
        });
      }

      const boundaryBuf = new TextEncoder().encode(`--${boundary}`);
      const CRLFCRLF = new Uint8Array([13, 10, 13, 10]);

      const parts: Array<{ headers: string; data: Uint8Array }> = [];

      const indexOfSub = (
        haystack: Uint8Array,
        needle: Uint8Array,
        from: number = 0,
      ): number => {
        outer: for (let i = from; i <= haystack.length - needle.length; i++) {
          for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
              continue outer;
            }
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
      const maxFileSizeBytes =
        parseSizeLimit(options?.maxFileSize, DEFAULT_FILE_SIZE) ??
        DEFAULT_FILE_SIZE;

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
          if (options?.maxFiles && files.length >= options.maxFiles) {
            return res.badRequest({
              ...errorFactory(
                new BaldaError(
                  `Too many files: Maximum ${options.maxFiles} files allowed`,
                ),
              ),
            });
          }

          if (maxFileSizeBytes && part.data.length > maxFileSizeBytes) {
            return res.badRequest({
              ...errorFactory(
                new FileTooLargeError(
                  originalName,
                  part.data.length,
                  maxFileSizeBytes,
                ),
              ),
            });
          }

          const contentTypeHeader = part.headers
            .split("\r\n")
            .find((h) => h.toLowerCase().startsWith("content-type:"));

          const mimeType = contentTypeHeader
            ? contentTypeHeader.split(":")[1].trim()
            : "application/octet-stream";

          if (
            options?.allowedMimeTypes &&
            !options.allowedMimeTypes.includes(mimeType)
          ) {
            return res.badRequest({
              ...errorFactory(
                new BaldaError(
                  `Invalid file type: "${mimeType}" is not allowed. Allowed types: ${options.allowedMimeTypes.join(", ")}`,
                ),
              ),
            });
          }

          // Get extension from MIME type, not from filename
          const extension = getExtensionFromMimeType(mimeType);
          const tmpPath = nativePath.join(
            await nativeOs.tmpdir(),
            `${nativeCrypto.randomUUID()}${extension}`,
          );
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
      req.body = fields;
      req.bodyUsed = true;

      await next();

      await cleanupTmpFiles(tmpPaths);
    } catch (error) {
      await cleanupTmpFiles(tmpPaths);
      throw error;
    }
  };
};

const cleanupTmpFiles = async (paths: string[]) => {
  await Promise.allSettled(paths.map((path) => nativeFs.unlink(path)));
};

const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x1f\x80-\x9f]/g, "")
    .trim();
};

// Map MIME types to safe extensions
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/json": ".json",
    "text/csv": ".csv",
    "application/octet-stream": ".bin",
    "application/x-www-form-urlencoded": ".urlencoded",
    "application/xml": ".xml",
    "application/yaml": ".yaml",
    "application/yml": ".yml",
    "application/csv": ".csv",
    "application/txt": ".txt",
    "application/markdown": ".markdown",
  };

  return mimeMap[mimeType.toLowerCase()] || ".bin";
};
