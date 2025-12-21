import { AzureBlobStorageProvider } from "./providers/blob_storage.js";
import { LocalStorageProvider } from "./providers/local.js";
import { S3StorageProvider } from "./providers/s3.js";

export type ReturnType = "raw" | "text" | "stream";
export type ReturnTypeMap<T extends ReturnType> = T extends "raw"
  ? Uint8Array
  : T extends "text"
    ? string
    : T extends "stream"
      ? ReadableStream
      : never;

/**
 * High level storage interface, provides a unified way to interact with different storage providers
 */
export interface StorageInterface {
  /**
   * Get the download signed url of the object
   * @param key - The key of the object
   * @returns The download signed url of the object
   * @warning not available in local storage provider
   * @throws if using local storage provider
   */
  getDownloadUrl: (key: string, expiresInSeconds?: number) => Promise<string>;
  /**
   * Get the upload signed url of the object
   * @param key - The key of the object
   * @returns The upload signed url of the object
   * @warning not available in local storage provider
   * @throws if using local storage provider
   */
  getUploadUrl: (key: string, expiresInSeconds?: number) => Promise<string>;
  /**
   * Get the public url of the object
   * @param key - The key of the object
   * @returns The public url of the object
   * @warning not available in local storage provider
   * @throws if using local storage provider
   */
  getPublicUrl: (key: string) => Promise<string>;
  /**
   * List the objects from the storage
   * @param prefix - The prefix of the objects
   * @returns The objects from the storage
   */
  listObjects: (prefix?: string) => Promise<string[]>;
  /**
   * Get the object from the storage
   * @param key - The key of the object
   * @throws If no file is found for the given key
   * @returns The object from the storage
   */
  getObject: <R extends ReturnType = "raw">(
    key: string,
    returnType: R,
  ) => Promise<ReturnTypeMap<R>>;
  /**
   * Put the object into the storage
   * @param key - The key of the object
   * @param value - The value of the object
   * @param contentType - The content type of the object
   * @returns The object from the storage
   */
  putObject: <T = Uint8Array>(
    key: string,
    value: T,
    contentType?: string,
  ) => Promise<void>;
  /**
   * Delete the object from the storage
   * @param key - The key of the object
   * @returns The object from the storage
   */
  deleteObject: (key: string) => Promise<void>;
}

export type StorageOptions<T extends BaseStorageProviderOptions> = {
  /**
   * The default provider to use
   */
  defaultProvider: keyof T;
};

/**
 * Mapping of the storage provider options
 */
export interface BaseStorageProviderOptions {
  local?: LocalStorageProvider;
  s3?: S3StorageProvider;
  azureBlobStorage?: AzureBlobStorageProvider;
}

/**
 * Custom storage providers
 */
export interface CustomStorageProviderOptions {
  [key: string]: StorageInterface;
}

export type StorageProviderOptions = CustomStorageProviderOptions &
  BaseStorageProviderOptions;
