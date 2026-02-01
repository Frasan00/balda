import type { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BaldaError } from "../../errors/balda_error.js";
import { FileNotFoundError } from "../../errors/file_not_found_error.js";
import { runtime } from "../../runtime/runtime.js";
import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
} from "../storage_types.js";

type S3ClientConfig = ConstructorParameters<typeof S3Client>[0];

/**
 * Bun S3 types (only available on Bun runtime)
 * These are declared here to avoid TypeScript errors on non-Bun runtimes
 */
interface BunS3File {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  stream(): ReadableStream;
  write(
    data: string | ArrayBuffer | Uint8Array | Blob | Response,
    options?: { type?: string },
  ): Promise<number>;
  delete(): Promise<void>;
  presign(options?: {
    method?: "GET" | "PUT" | "DELETE" | "HEAD" | "POST";
    expiresIn?: number;
    type?: string;
    acl?: string;
  }): string;
  exists(): Promise<boolean>;
}

interface BunS3Client {
  file(key: string): BunS3File;
}

interface BunS3ClientConstructor {
  new (options: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    endpoint?: string;
    bucket?: string;
  }): BunS3Client;
}

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
  declare private bunS3Client: BunS3Client;
  private readonly isBun: boolean;
  private clientInitialized = false;
  readonly options: S3StorageProviderOptions;

  constructor(options: S3StorageProviderOptions) {
    this.options = options;
    this.isBun = runtime.type === "bun";
  }

  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();

    // If CloudFront is configured, use it (requires AWS SDK)
    if (this.options.cloudfrontOptions) {
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

    if (this.isBun) {
      const file = this.bunS3Client.file(key);
      return file.presign({
        method: "GET",
        expiresIn: expiresInSeconds,
      });
    }

    throw new BaldaError(
      "getDownloadUrl requires CloudFront configuration on Node.js/Deno",
    );
  }

  async getUploadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureClient();

    // Use Bun native presign
    if (this.isBun) {
      const file = this.bunS3Client.file(key);
      return file.presign({
        method: "PUT",
        expiresIn: expiresInSeconds,
      });
    }

    // Use AWS SDK presigner
    const command = new this.s3Lib.PutObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
    });

    return this.s3PresignerLib.getSignedUrl(
      this.s3Client as S3Client,
      command as PutObjectCommand,
      {
        expiresIn: expiresInSeconds,
      },
    );
  }

  async getPublicUrl(key: string): Promise<string> {
    await this.ensureClient();
    const { region, endpoint } = this.options.s3ClientConfig;
    const bucketName = this.options.s3ClientConfig.bucketName;

    if (endpoint) {
      const endpointUrl =
        typeof endpoint === "string" ? endpoint : endpoint.toString();
      return `${endpointUrl}/${bucketName}/${key}`;
    }

    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  async listObjects(prefix?: string): Promise<string[]> {
    await this.ensureAwsSdk();
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

    if (this.isBun) {
      try {
        const file = this.bunS3Client.file(key);
        const exists = await file.exists();
        if (!exists) {
          throw new FileNotFoundError(key);
        }

        const type = returnType as ReturnType;
        switch (type) {
          case "raw": {
            const buffer = await file.arrayBuffer();
            return new Uint8Array(buffer) as ReturnTypeMap<R>;
          }
          case "text": {
            return (await file.text()) as ReturnTypeMap<R>;
          }
          case "stream": {
            return file.stream() as ReturnTypeMap<R>;
          }
          default: {
            throw new BaldaError("Invalid return type");
          }
        }
      } catch (error) {
        if (error instanceof FileNotFoundError) {
          throw error;
        }
        // Handle Bun S3 errors
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error.code === "NoSuchKey" || error.code === "NotFound")
        ) {
          throw new FileNotFoundError(key);
        }
        throw error;
      }
    }

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
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "NoSuchKey"
      ) {
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

    if (this.isBun) {
      const file = this.bunS3Client.file(key);
      await file.write(value as string | ArrayBuffer | Uint8Array | Blob, {
        type: contentType,
      });
      return;
    }

    const command = new this.s3Lib.PutObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
      Body: value as PutObjectCommand["input"]["Body"],
      ContentType: contentType,
    });
    await this.s3Client.send(command);
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureClient();

    // Use Bun native S3
    if (this.isBun) {
      const file = this.bunS3Client.file(key);
      await file.delete();
      return;
    }

    // Use AWS SDK
    const command = new this.s3Lib.DeleteObjectCommand({
      Bucket: this.options.s3ClientConfig.bucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  /**
   * Ensures the appropriate S3 client is initialized based on runtime
   */
  private async ensureClient(): Promise<void> {
    if (this.clientInitialized) {
      return;
    }

    if (this.isBun) {
      await this.ensureBunClient();
    } else {
      await this.ensureAwsSdk();
    }

    // CloudFront signer is always AWS SDK (if configured)
    if (this.options.cloudfrontOptions) {
      this.cloudfrontSignerLib = await import("@aws-sdk/cloudfront-signer")
        .then(
          (mod) => (mod as unknown as { default?: typeof mod }).default ?? mod,
        )
        .catch(() => {
          throw new BaldaError(
            "Library not installed: @aws-sdk/cloudfront-signer, try run npm install @aws-sdk/cloudfront-signer",
          );
        });
    }

    this.clientInitialized = true;
  }

  /**
   * Initialize Bun's native S3 client
   */
  private async ensureBunClient(): Promise<void> {
    if (this.bunS3Client) {
      return;
    }

    // Extract credentials from AWS SDK config format
    const config = this.options.s3ClientConfig;
    const credentials =
      typeof config.credentials === "function"
        ? await config.credentials()
        : config.credentials;

    const endpoint =
      typeof config.endpoint === "string"
        ? config.endpoint
        : config.endpoint?.toString();

    // Access Bun.S3Client via globalThis to avoid TypeScript errors
    const BunS3ClientClass = (
      globalThis as unknown as { Bun: { S3Client: BunS3ClientConstructor } }
    ).Bun.S3Client;

    this.bunS3Client = new BunS3ClientClass({
      accessKeyId: credentials?.accessKeyId,
      secretAccessKey: credentials?.secretAccessKey,
      sessionToken: credentials?.sessionToken,
      region: config.region as string | undefined,
      endpoint: endpoint,
      bucket: config.bucketName,
    });
  }

  /**
   * Initialize AWS SDK S3 client (used for listObjects and as fallback)
   */
  private async ensureAwsSdk(): Promise<void> {
    if (this.s3Lib) {
      return;
    }

    this.s3Lib = await import("@aws-sdk/client-s3")
      .then(
        (mod) => (mod as unknown as { default?: typeof mod }).default ?? mod,
      )
      .catch(() => {
        throw new BaldaError(
          "Library not installed: @aws-sdk/client-s3, try run npm install @aws-sdk/client-s3",
        );
      });

    this.s3PresignerLib = await import("@aws-sdk/s3-request-presigner")
      .then(
        (mod) => (mod as unknown as { default?: typeof mod }).default ?? mod,
      )
      .catch(() => {
        throw new BaldaError(
          "Library not installed: @aws-sdk/s3-request-presigner, try run npm install @aws-sdk/s3-request-presigner",
        );
      });

    this.s3Client = new this.s3Lib.S3Client(this.options.s3ClientConfig ?? {});
  }
}
