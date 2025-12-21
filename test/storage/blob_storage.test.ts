import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AzureBlobStorageProvider } from "../../src/storage/providers/blob_storage.js";

describe("AzureBlobStorageProvider with Azurite", () => {
  let provider: AzureBlobStorageProvider;
  const containerName = process.env.AZURE_CONTAINER_NAME || "test-container";
  const testKeyPrefix = `test-${Date.now()}`;

  beforeAll(async () => {
    const connectionString =
      process.env.AZURE_CONNECTION_STRING ||
      "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

    provider = new AzureBlobStorageProvider({
      containerName,
      connectionString,
      storageAccountName: "devstoreaccount1",
      storageAccountKey:
        "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    });

    try {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
    } catch (error) {
      console.log("Container might already exist, continuing...");
    }
  });

  afterAll(async () => {
    try {
      const files = await provider.listObjects(testKeyPrefix);
      for (const file of files) {
        await provider.deleteObject(file);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("putObject", () => {
    it("should upload a blob to Azure Storage", async () => {
      const key = `${testKeyPrefix}/upload-test.txt`;
      const content = new TextEncoder().encode("Azure test content");

      await provider.putObject(key, content, "text/plain");

      const retrieved = await provider.getObject(key);
      expect(retrieved).toBeDefined();
    });

    it("should upload binary data", async () => {
      const key = `${testKeyPrefix}/binary-test.bin`;
      const binaryData = new Uint8Array([10, 20, 30, 40, 50]);

      await provider.putObject(key, binaryData, "application/octet-stream");

      const retrieved = await provider.getObject(key);
      expect(retrieved).toBeDefined();
      expect(retrieved?.length).toBe(5);
    });

    it("should set default content type when not specified", async () => {
      const key = `${testKeyPrefix}/no-content-type.txt`;
      const content = new TextEncoder().encode("No content type");

      await provider.putObject(key, content);

      const retrieved = await provider.getObject(key);
      expect(retrieved).toBeDefined();
    });
  });

  describe("getObject", () => {
    beforeAll(async () => {
      const key = `${testKeyPrefix}/get-test.txt`;
      const content = new TextEncoder().encode("Get test content");
      await provider.putObject(key, content);
    });

    it("should retrieve an existing blob", async () => {
      const key = `${testKeyPrefix}/get-test.txt`;
      const result = await provider.getObject(key);

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Get test content");
    });

    it("should throw error for non-existent blob", async () => {
      await expect(
        provider.getObject("non-existent-blob-123456"),
      ).rejects.toThrow("File not found: non-existent-blob-123456");
    });

    it("should retrieve as raw Uint8Array (default return type)", async () => {
      const key = `${testKeyPrefix}/raw-test.txt`;
      const content = new TextEncoder().encode("Raw data test");

      await provider.putObject(key, content);
      const result = await provider.getObject(key, "raw");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Raw data test");
    });

    it("should retrieve as text string", async () => {
      const key = `${testKeyPrefix}/text-test.txt`;
      const content = new TextEncoder().encode("Text return type test");

      await provider.putObject(key, content);
      const result = await provider.getObject(key, "text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toBe("Text return type test");
    });

    it("should retrieve as ReadableStream", async () => {
      const key = `${testKeyPrefix}/stream-test.txt`;
      const content = new TextEncoder().encode("Stream return type test");

      await provider.putObject(key, content);
      const result = await provider.getObject(key, "stream");

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
      expect(text).toBe("Stream return type test");
    });
  });

  describe("listObjects", () => {
    beforeAll(async () => {
      await provider.putObject(
        `${testKeyPrefix}/list/file1.txt`,
        new TextEncoder().encode("1"),
      );
      await provider.putObject(
        `${testKeyPrefix}/list/file2.txt`,
        new TextEncoder().encode("2"),
      );
      await provider.putObject(
        `${testKeyPrefix}/list/subfolder/file3.txt`,
        new TextEncoder().encode("3"),
      );
      await provider.putObject(
        `${testKeyPrefix}/other/file4.txt`,
        new TextEncoder().encode("4"),
      );
    });

    it("should list all blobs with prefix", async () => {
      const files = await provider.listObjects(testKeyPrefix);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toEqual(
        expect.arrayContaining([`${testKeyPrefix}/list/file1.txt`]),
      );
    });

    it("should list blobs with specific prefix", async () => {
      const files = await provider.listObjects(`${testKeyPrefix}/list`);
      expect(files.length).toBe(3);
      expect(files).toEqual(
        expect.arrayContaining([
          `${testKeyPrefix}/list/file1.txt`,
          `${testKeyPrefix}/list/file2.txt`,
          `${testKeyPrefix}/list/subfolder/file3.txt`,
        ]),
      );
    });

    it("should return empty array for non-existent prefix", async () => {
      const files = await provider.listObjects("non-existent-prefix-xyz");
      expect(files).toEqual([]);
    });
  });

  describe("deleteObject", () => {
    it("should delete an existing blob", async () => {
      const key = `${testKeyPrefix}/delete-test.txt`;
      await provider.putObject(key, new TextEncoder().encode("to be deleted"));

      await provider.deleteObject(key);

      await expect(provider.getObject(key)).rejects.toThrow(
        `File not found: ${key}`,
      );
    });

    it("should not throw when deleting non-existent blob", async () => {
      await provider.deleteObject("non-existent-delete-key");
    });
  });

  describe("getDownloadUrl", () => {
    it("should generate a SAS token for download", async () => {
      const key = `${testKeyPrefix}/sas-download.txt`;
      await provider.putObject(key, new TextEncoder().encode("SAS test"));

      const url = await provider.getDownloadUrl(key, 3600);

      expect(url).toBeDefined();
      expect(url).toContain(containerName);
      expect(url).toContain(key);
      expect(url).toContain("sig=");
      expect(url).toContain("se=");
      expect(url).toContain("sp=r");
    });

    it("should generate URL with custom expiration", async () => {
      const key = `${testKeyPrefix}/sas-short.txt`;
      await provider.putObject(key, new TextEncoder().encode("Short SAS"));

      const url = await provider.getDownloadUrl(key, 60);

      expect(url).toBeDefined();
      expect(url).toContain("sig=");
    });
  });

  describe("getUploadUrl", () => {
    it("should generate a SAS token for upload", async () => {
      const key = `${testKeyPrefix}/sas-upload.txt`;

      const url = await provider.getUploadUrl(key, 3600);

      expect(url).toBeDefined();
      expect(url).toContain(containerName);
      expect(url).toContain(key);
      expect(url).toContain("sig=");
      expect(url).toContain("se=");
      expect(url).toContain("sp=w");
    });

    it("should generate upload URL with custom expiration", async () => {
      const key = `${testKeyPrefix}/sas-upload-short.txt`;

      const url = await provider.getUploadUrl(key, 120);

      expect(url).toBeDefined();
      expect(url).toContain("sig=");
    });
  });

  describe("SAS URL functionality", () => {
    it("should allow download using generated SAS URL", async () => {
      const key = `${testKeyPrefix}/sas-functional-test.txt`;
      const content = new TextEncoder().encode("SAS functional test");
      await provider.putObject(key, content);

      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl);
      expect(response.ok).toBe(true);

      const downloadedContent = await response.arrayBuffer();
      const text = new TextDecoder().decode(downloadedContent);
      expect(text).toBe("SAS functional test");
    });
  });

  describe("getPublicUrl", () => {
    it("should generate public URL for blob", async () => {
      const key = `${testKeyPrefix}/public-test.txt`;
      const url = await provider.getPublicUrl(key);

      expect(url).toBeDefined();
      expect(url).toContain(containerName);
      expect(url).toContain(key);
      expect(url).not.toContain("sig=");
      expect(url).not.toContain("se=");
    });

    it("should generate URL without SAS token", async () => {
      const key = `${testKeyPrefix}/public-no-sas.txt`;
      await provider.putObject(key, new TextEncoder().encode("Public content"));

      const publicUrl = await provider.getPublicUrl(key);
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      expect(publicUrl).toBeDefined();
      expect(sasUrl).toContain("sig=");
      expect(publicUrl).not.toContain("sig=");
      expect(sasUrl.split("?")[0]).toBe(publicUrl);
    });

    it("should allow HTTP access to public URL with SAS", async () => {
      const key = `${testKeyPrefix}/public-http-test.txt`;
      const content = "Public HTTP test content";
      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl);
      expect(response.ok).toBe(true);

      const downloadedContent = await response.text();
      expect(downloadedContent).toBe(content);

      expect(publicUrl).toBe(sasUrl.split("?")[0]);
    });
  });
});
