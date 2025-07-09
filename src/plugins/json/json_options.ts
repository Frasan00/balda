export interface JsonOptions {
  /**
   * The maximum size of the JSON body in bytes.
   * If the body is larger than this limit, the request will be rejected.
   * Default: 5mb
   */
  sizeLimit?: number;

  /**
   * If true, the JSON body will be parsed as an empty object if it is empty.
   * Default: false (body will be undefined)
   */
  parseEmptyBodyAsObject?: boolean;

  /**
   * The encoding to use when decoding the request body.
   * Default: "utf-8"
   */
  encoding?: TextDecoderEncoding;

  /**
   * The custom error message to return when the JSON body is too large.
   * Default: response with status 413 and body { message: "ERR_REQUEST_BODY_TOO_LARGE" }
   */
  customErrorMessage?: {
    status?: number;
    message?: string;
  };
}

/**
 * Supported text encodings for TextDecoder.
 * Based on the WHATWG Encoding Standard.
 */
export type TextDecoderEncoding =
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "gbk"
  | "gb18030"
  | "big5"
  | "euc-jp"
  | "iso-2022-jp"
  | "shift-jis"
  | "euc-kr"
  | "iso-2022-kr"
  | "iso-8859-1"
  | "iso-8859-2"
  | "iso-8859-3"
  | "iso-8859-4"
  | "iso-8859-5"
  | "iso-8859-6"
  | "iso-8859-7"
  | "iso-8859-8"
  | "iso-8859-9"
  | "iso-8859-10"
  | "iso-8859-13"
  | "iso-8859-14"
  | "iso-8859-15"
  | "iso-8859-16"
  | "windows-1250"
  | "windows-1251"
  | "windows-1252"
  | "windows-1253"
  | "windows-1254"
  | "windows-1255"
  | "windows-1256"
  | "windows-1257"
  | "windows-1258"
  | "x-mac-cyrillic"
  | "x-mac-greek"
  | "x-mac-icelandic"
  | "x-mac-latin2"
  | "x-mac-roman"
  | "x-mac-turkish"
  | "koi8-r"
  | "koi8-u";
