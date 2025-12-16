import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nativeFs } from "../../src/runtime/native_fs.js";
import { nativePath } from "../../src/runtime/native_path.js";
import { AzureBlobStorageProvider } from "../../src/storage/providers/blob_storage.js";
import { LocalStorageProvider } from "../../src/storage/providers/local.js";
import { S3StorageProvider } from "../../src/storage/providers/s3.js";
import { Storage } from "../../src/storage/storage.js";
import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
} from "../../src/storage/storage_types.js";

class CustomStorageProvider implements StorageInterface {
  private storage = new Map<string, Uint8Array>();

  async getDownloadUrl(key: string, _expiresIn?: number): Promise<string> {
    return `custom://download/${key}`;
  }

  async getUploadUrl(key: string, _expiresIn?: number): Promise<string> {
    return `custom://upload/${key}`;
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    if (!prefix) {
      return keys;
    }
    return keys.filter((key) => key.startsWith(prefix));
  }

  async getObject<R extends ReturnType = "raw">(
    key: string,
    _returnType?: R,
  ): Promise<ReturnTypeMap<R>> {
    return this.storage.get(key) as ReturnTypeMap<R>;
  }

  async putObject<T = Uint8Array>(
    key: string,
    value: T,
    _contentType?: string,
  ): Promise<void> {
    this.storage.set(key, value as Uint8Array);
  }

  async deleteObject(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

describe("Storage with multiple providers", () => {
  const testDir = nativePath.resolve("./test-storage-multi");
  let storage: Storage<{
    local: LocalStorageProvider;
    s3: S3StorageProvider;
    azure: AzureBlobStorageProvider;
    custom: CustomStorageProvider;
  }>;

  beforeAll(async () => {
    await nativeFs.mkdir(testDir, { recursive: true });

    const localProvider = new LocalStorageProvider({
      directory: testDir,
    });

    const s3Provider = new S3StorageProvider({
      s3ClientConfig: {
        bucketName: process.env.S3_BUCKET || "test-bucket",
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
        forcePathStyle: true,
      },
    });

    const connectionString =
      process.env.AZURE_CONNECTION_STRING ||
      "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

    const azureProvider = new AzureBlobStorageProvider({
      containerName: process.env.AZURE_CONTAINER_NAME || "test-container",
      connectionString,
      storageAccountName: "devstoreaccount1",
      storageAccountKey:
        "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    });

    const customProvider = new CustomStorageProvider();

    storage = new Storage(
      {
        local: localProvider,
        s3: s3Provider,
        azure: azureProvider,
        custom: customProvider,
      },
      { defaultProvider: "local" },
    );

    try {
      const { S3Client, CreateBucketCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
        forcePathStyle: true,
      });
      await client.send(
        new CreateBucketCommand({
          Bucket: process.env.S3_BUCKET || "test-bucket",
        }),
      );
    } catch (error) {
      console.log("S3 bucket setup issue:", error);
    }

    try {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(
        process.env.AZURE_CONTAINER_NAME || "test-container",
      );
      await containerClient.createIfNotExists();
    } catch (error) {
      console.log("Azure container setup issue:", error);
    }
  });

  afterAll(async () => {
    const exists = await nativeFs.exists(testDir);
    if (exists) {
      const { runtime } = await import("../../src/runtime/runtime.js");
      switch (runtime.type) {
        case "node":
        case "bun": {
          const fs = await import("fs/promises");
          await fs.rm(testDir, { recursive: true, force: true });
          break;
        }
        case "deno": {
          await Deno.remove(testDir, { recursive: true });
          break;
        }
      }
    }
  });

  describe("default provider", () => {
    it("should use local provider by default", async () => {
      const key = "default-test.txt";
      const content = new TextEncoder().encode("default provider test");

      await storage.putObject(key, content);
      const result = await storage.getObject(key);

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("default provider test");

      await storage.deleteObject(key);
    });

    it("should list objects from default provider", async () => {
      const key = "list-default.txt";
      await storage.putObject(key, new TextEncoder().encode("list test"));

      const files = await storage.listObjects();
      expect(files).toEqual(expect.arrayContaining([key]));

      await storage.deleteObject(key);
    });

    it("should retrieve as raw Uint8Array from default provider", async () => {
      const key = "raw-default.txt";
      const content = new TextEncoder().encode("Raw default test");

      await storage.putObject(key, content);
      const result = await storage.getObject(key, "raw");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Raw default test");

      await storage.deleteObject(key);
    });

    it("should retrieve as text string from default provider", async () => {
      const key = "text-default.txt";
      const content = new TextEncoder().encode("Text default test");

      await storage.putObject(key, content);
      const result = await storage.getObject(key, "text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toBe("Text default test");

      await storage.deleteObject(key);
    });

    it("should retrieve as ReadableStream from default provider", async () => {
      const key = "stream-default.txt";
      const content = new TextEncoder().encode("Stream default test");

      await storage.putObject(key, content);
      const result = await storage.getObject(key, "stream");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(ReadableStream);

      const reader = (result as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }

      const combined = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      expect(text).toBe("Stream default test");

      await storage.deleteObject(key);
    });
  });

  describe("use() method", () => {
    it("should switch to S3 provider using use()", async () => {
      const key = `multi-test-${Date.now()}/s3-test.txt`;
      const content = new TextEncoder().encode("S3 specific test");

      await storage.use("s3").putObject(key, content);
      const result = await storage.use("s3").getObject(key, "raw");

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("S3 specific test");

      await storage.use("s3").deleteObject(key);
    });

    it("should switch to Azure provider using use()", async () => {
      const key = `multi-test-${Date.now()}/azure-test.txt`;
      const content = new TextEncoder().encode("Azure specific test");

      await storage.use("azure").putObject(key, content);
      const result = await storage.use("azure").getObject(key, "raw");

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Azure specific test");

      await storage.use("azure").deleteObject(key);
    });

    it("should switch to custom provider using use()", async () => {
      const key = "custom-test.txt";
      const content = new TextEncoder().encode("Custom provider test");

      await storage.use("custom").putObject(key, content);
      const result = await storage.use("custom").getObject(key, "raw");

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Custom provider test");

      await storage.use("custom").deleteObject(key);
    });

    it("should throw error for non-existent provider", () => {
      expect(() => {
        storage.use("nonexistent" as any);
      }).toThrow("[Storage] Provider nonexistent not found");
    });

    it("should retrieve as text from S3 provider", async () => {
      const key = `multi-test-${Date.now()}/s3-text.txt`;
      const content = new TextEncoder().encode("S3 text test");

      await storage.use("s3").putObject(key, content);
      const result = await storage.use("s3").getObject(key, "text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toBe("S3 text test");

      await storage.use("s3").deleteObject(key);
    });

    it("should retrieve as stream from S3 provider", async () => {
      const key = `multi-test-${Date.now()}/s3-stream.txt`;
      const content = new TextEncoder().encode("S3 stream test");

      await storage.use("s3").putObject(key, content);
      const result = await storage.use("s3").getObject(key, "stream");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(ReadableStream);

      const reader = (result as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }

      const combined = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      expect(text).toBe("S3 stream test");

      await storage.use("s3").deleteObject(key);
    });

    it("should retrieve as text from Azure provider", async () => {
      const key = `multi-test-${Date.now()}/azure-text.txt`;
      const content = new TextEncoder().encode("Azure text test");

      await storage.use("azure").putObject(key, content);
      const result = await storage.use("azure").getObject(key, "text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toBe("Azure text test");

      await storage.use("azure").deleteObject(key);
    });

    it("should retrieve as stream from Azure provider", async () => {
      const key = `multi-test-${Date.now()}/azure-stream.txt`;
      const content = new TextEncoder().encode("Azure stream test");

      await storage.use("azure").putObject(key, content);
      const result = await storage.use("azure").getObject(key, "stream");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(ReadableStream);

      const reader = (result as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }

      const combined = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      expect(text).toBe("Azure stream test");

      await storage.use("azure").deleteObject(key);
    });
  });

  describe("custom provider functionality", () => {
    it("should store and retrieve from custom provider", async () => {
      const customStorage = storage.use("custom");

      await customStorage.putObject(
        "custom1.txt",
        new TextEncoder().encode("1"),
      );
      await customStorage.putObject(
        "custom2.txt",
        new TextEncoder().encode("2"),
      );
      await customStorage.putObject(
        "other.txt",
        new TextEncoder().encode("other"),
      );

      const allFiles = await customStorage.listObjects();
      expect(allFiles).toHaveLength(3);

      const customFiles = await customStorage.listObjects("custom");
      expect(customFiles).toHaveLength(2);
      expect(customFiles).toEqual(
        expect.arrayContaining(["custom1.txt", "custom2.txt"]),
      );
    });

    it("should generate custom URLs", async () => {
      const customStorage = storage.use("custom");
      const key = "url-test.txt";

      const downloadUrl = await customStorage.getDownloadUrl(key);
      const uploadUrl = await customStorage.getUploadUrl(key);

      expect(downloadUrl).toBe(`custom://download/${key}`);
      expect(uploadUrl).toBe(`custom://upload/${key}`);
    });
  });

  describe("cross-provider operations", () => {
    it("should store same key in different providers independently", async () => {
      const key = "shared-key.txt";
      const localContent = new TextEncoder().encode("Local content");
      const customContent = new TextEncoder().encode("Custom content");

      await storage.use("local").putObject(key, localContent);
      await storage.use("custom").putObject(key, customContent);

      const localResult = await storage.use("local").getObject(key, "raw");
      const customResult = await storage.use("custom").getObject(key, "raw");

      expect(new TextDecoder().decode(localResult)).toBe("Local content");
      expect(new TextDecoder().decode(customResult)).toBe("Custom content");

      await storage.use("local").deleteObject(key);
      await storage.use("custom").deleteObject(key);
    });

    it("should handle different methods across providers", async () => {
      const localKey = "local-only.txt";
      const s3Key = `multi-test-${Date.now()}/s3-only.txt`;

      await storage
        .use("local")
        .putObject(localKey, new TextEncoder().encode("local"));
      await storage.use("s3").putObject(s3Key, new TextEncoder().encode("s3"));

      const localFiles = await storage.use("local").listObjects();
      const s3Files = await storage.use("s3").listObjects(`multi-test-`);

      expect(localFiles).toContain(localKey);
      expect(s3Files.some((f) => f.includes("s3-only"))).toBe(true);

      await storage.use("local").deleteObject(localKey);
      await storage.use("s3").deleteObject(s3Key);
    });
  });

  describe("provider isolation", () => {
    it("should not affect other providers when deleting from one", async () => {
      const key = "isolation-test.txt";

      await storage
        .use("local")
        .putObject(key, new TextEncoder().encode("local"));
      await storage
        .use("custom")
        .putObject(key, new TextEncoder().encode("custom"));

      await storage.use("local").deleteObject(key);

      await expect(storage.use("local").getObject(key, "raw")).rejects.toThrow(
        `File not found: ${key}`,
      );
      const customResult = await storage.use("custom").getObject(key, "raw");

      expect(customResult).toBeDefined();
      expect(new TextDecoder().decode(customResult)).toBe("custom");

      await storage.use("custom").deleteObject(key);
    });
  });
});
