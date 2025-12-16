import type { S3Client } from "@aws-sdk/client-s3";
import { BaldaError } from "../../errors/balda_error.js";
import { FileNotFoundError } from "../../errors/file_not_found_error.js";
import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
} from "../storage_types.js";

type S3ClientConfig = ConstructorParameters<typeof S3Client>[0];

export type S3StorageProviderOptions = {
  s3ClientConfig: S3ClientConfig & { bucketName: string };
  /**
   * The cloudfront options (optional), allows to get the cloudfront signed url for an object, enables the `getDownloadUrl` method that throws an error if not configured
   */
  cloudfrontOptions?: {
    /**
     * The CloudFront distribution domain name (e.g., 'd1234567890.cloudfront.net')
     */
    domainName: string;
    /**
     * The CloudFront key pair ID
     */
    keyPairId: string;
    /**
     * The private key in PEM format for signing URLs
     */
    privateKey: string;
  };
};

export class S3StorageProvider implements StorageInterface {
  declare private s3Lib: typeof import("@aws-sdk/client-s3");
  declare private s3PresignerLib: typeof import("@aws-sdk/s3-request-presigner");
  declare private cloudfrontSignerLib: typeof import("@aws-sdk/cloudfront-signer");
  declare private s3Client: S3Client;
  readonly options: S3StorageProviderOptions;

  constructor(options: S3StorageProviderOptions) {
    this.options = options;
  }

  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();

    if (!this.options.cloudfrontOptions) {
      throw new BaldaError("getDownloadUrl requires CloudFront configuration");
    }

    const { domainName, keyPairId, privateKey } =
      this.options.cloudfrontOptions;
    const url = `https://${domainName}/${key}`;
    const dateLessThan = new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString();

    return this.cloudfrontSignerLib.getSignedUrl({
      url,
      keyPairId,
      privateKey,
      dateLessThan,
    });
  }

  async getUploadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();
    const command = new this.s3Lib.PutObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
    });

    return this.s3PresignerLib.getSignedUrl(
      this.s3Client as any,
      command as any,
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  async listObjects(prefix?: string): Promise<string[]> {
    await this.ensureClient();
    const command = new this.s3Lib.ListObjectsV2Command({
      Bucket: this.options.s3ClientConfig.bucketName,
      Prefix: prefix,
    });
    const response = await this.s3Client.send(command);
    return response.Contents?.map((item) => item.Key!).filter(Boolean) ?? [];
  }

  async getObject<R extends ReturnType = "raw">(
    key: string,
    returnType: R = "raw" as R,
  ): Promise<ReturnTypeMap<R>> {
    await this.ensureClient();
    const command = new this.s3Lib.GetObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new FileNotFoundError(key);
      }

      const type = returnType as ReturnType;
      switch (type) {
        case "raw": {
          return (await response.Body.transformToByteArray()) as ReturnTypeMap<R>;
        }
        case "text": {
          return (await response.Body.transformToString()) as ReturnTypeMap<R>;
        }
        case "stream": {
          return response.Body.transformToWebStream() as ReturnTypeMap<R>;
        }
        default: {
          throw new BaldaError("Invalid return type");
        }
      }
    } catch (error) {
      if ((error as any).name === "NoSuchKey") {
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
    const command = new this.s3Lib.PutObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
      Body: value as any,
      ContentType: contentType,
    });
    await this.s3Client.send(command);
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureClient();
    const command = new this.s3Lib.DeleteObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  private async ensureClient(): Promise<void> {
    if (this.s3Lib) {
      return;
    }

    this.s3Lib = await import("@aws-sdk/client-s3")
      .then((mod) => mod.default)
      .catch(() => {
        throw new BaldaError(
          "Library not installed: @aws-sdk/client-s3, try run npm install @aws-sdk/client-s3",
        );
      });

    this.s3PresignerLib = await import("@aws-sdk/s3-request-presigner")
      .then((mod) => mod.default)
      .catch(() => {
        throw new BaldaError(
          "Library not installed: @aws-sdk/s3-request-presigner, try run npm install @aws-sdk/s3-request-presigner",
        );
      });

    if (this.options.cloudfrontOptions) {
      this.cloudfrontSignerLib = await import("@aws-sdk/cloudfront-signer")
        .then((mod) => mod.default)
        .catch(() => {
          throw new BaldaError(
            "Library not installed: @aws-sdk/cloudfront-signer, try run npm install @aws-sdk/cloudfront-signer",
          );
        });
    }

    this.s3Client = new this.s3Lib.S3Client(this.options.s3ClientConfig ?? {});
  }
}
