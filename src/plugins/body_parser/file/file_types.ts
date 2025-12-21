import { FileAllowedMimeType } from "../../static/static_types.js";

export type FormFile = {
  /**
   * The name of the form field.
   */
  formName: string;
  /**
   * The mime type of the file. (e.g. "image/png")
   */
  mimeType: string;
  /**
   * The size of the file in bytes.
   */
  size: number;
  /**
   * The temporary path of the file. Will be deleted after the request is processed automatically even in error cases.
   */
  tmpPath: string;

  /**
   * The original filename (including extension) as sent by the client
   * (e.g. "avatar.png", "document.txt").
   */
  originalName: string;
};

export type FilePluginOptions = {
  /**
   * The maximum size of each file.
   * Supports formats like "5mb", "100kb".
   * Example: "10mb", "500kb"
   * Default: 1mb
   */
  maxFileSize?: `${number}mb` | `${number}kb`;

  /**
   * The maximum number of files allowed in a single request.
   */
  maxFiles?: number;

  /**
   * Allowed MIME types for uploaded files.
   * If specified, only files with these MIME types will be accepted.
   * Example: ['image/jpeg', 'image/png', 'application/pdf']
   */
  allowedMimeTypes?: (FileAllowedMimeType | (string & {}))[];
};
