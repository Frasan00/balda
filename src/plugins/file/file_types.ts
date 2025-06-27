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
   * The maximum size of the file in bytes.
   */
  maxFileSize?: number;
};
