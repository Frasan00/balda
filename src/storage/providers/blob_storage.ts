import type {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { Readable } from "node:stream";
import { BaldaError } from "../../errors/balda_error.js";
import { FileNotFoundError } from "../../errors/file_not_found_error.js";
import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
} from "../storage_types.js";

export type BlobStorageProviderOptions = {
  /**
   * The container name
   */
  containerName: string;
  /**
   * The connection string to the storage account
   */
  connectionString: string;
  /**
   * The storage account name
   */
  storageAccountName: string;
  /**
   * The storage account key
   */
  storageAccountKey: string;
};

export class AzureBlobStorageProvider implements StorageInterface {
  declare private azureBlobLib: typeof import("@azure/storage-blob");
  declare private blobServiceClient: BlobServiceClient;
  declare private containerClient: ContainerClient;
  declare private sharedKeyCredential: StorageSharedKeyCredential;

  constructor(private readonly options: BlobStorageProviderOptions) {}

  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

    const permissions = this.azureBlobLib.BlobSASPermissions.parse("r");

    const sasToken = this.azureBlobLib
      .generateBlobSASQueryParameters(
        {
          containerName: this.options.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
        },
        this.sharedKeyCredential,
      )
      .toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async getUploadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

    const permissions = this.azureBlobLib.BlobSASPermissions.parse("w");

    const sasToken = this.azureBlobLib
      .generateBlobSASQueryParameters(
        {
          containerName: this.options.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
        },
        this.sharedKeyCredential,
      )
      .toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async getPublicUrl(key: string): Promise<string> {
    await this.ensureClient();
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    return blockBlobClient.url;
  }

  async listObjects(prefix?: string): Promise<string[]> {
    await this.ensureClient();

    const files: string[] = [];
    const listPrefix = prefix
      ? prefix.endsWith("/")
        ? prefix
        : `${prefix}/`
      : undefined;

    for await (const blob of this.containerClient.listBlobsFlat({
      prefix: listPrefix,
    })) {
      files.push(blob.name);
    }

    return files;
  }

  async getObject<R extends ReturnType = "raw">(
    key: string,
    returnType: R = "raw" as R,
  ): Promise<ReturnTypeMap<R>> {
    await this.ensureClient();

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(key);
      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new FileNotFoundError(key);
      }

      const type = returnType as ReturnType;
      if (type === "stream") {
        return Readable.toWeb(
          downloadResponse.readableStreamBody as Readable,
        ) as unknown as ReturnTypeMap<R>;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
        );
      }

      const buffer = Buffer.concat(chunks);
      switch (type) {
        case "raw": {
          return new Uint8Array(buffer) as ReturnTypeMap<R>;
        }
        case "text": {
          return buffer.toString() as ReturnTypeMap<R>;
        }
        default: {
          throw new BaldaError("Invalid return type");
        }
      }
    } catch (error) {
      if ((error as any).statusCode === 404) {
        throw new FileNotFoundError(key);
      }
      throw error;
    }
  }

  async putObject<T = Uint8Array>(
    key: string,
    value: T,
    contentType?: string,
  ): Promise<void> {
    await this.ensureClient();

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    const data = value as Uint8Array;

    await blockBlobClient.upload(data, data.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || "application/octet-stream",
      },
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureClient();

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    try {
      await blockBlobClient.delete();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 404
      ) {
        return;
      }
      throw error;
    }
  }

  private async ensureClient(): Promise<void> {
    if (this.azureBlobLib) {
      return;
    }

    this.azureBlobLib = await import("@azure/storage-blob").catch(() => {
      throw new BaldaError(
        "Library not installed: @azure/storage-blob, try run npm install @azure/storage-blob",
      );
    });

    this.blobServiceClient =
      this.azureBlobLib.BlobServiceClient.fromConnectionString(
        this.options.connectionString,
      );

    this.containerClient = this.blobServiceClient.getContainerClient(
      this.options.containerName,
    );

    const credential = this.blobServiceClient.credential;
    if (!(credential instanceof this.azureBlobLib.StorageSharedKeyCredential)) {
      throw new BaldaError(
        "BlobStorage requires a shared key credential to generate SAS URLs",
      );
    }

    this.sharedKeyCredential = credential;
  }
}
