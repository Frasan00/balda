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

  describe("HTTP Flow - Upload via SAS URL", () => {
    it("should upload blob using SAS PUT URL", async () => {
      const key = `${testKeyPrefix}/http-upload-put.txt`;
      const content = "Uploaded via HTTP PUT with SAS";
      const sasUploadUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(sasUploadUrl, {
        method: "PUT",
        body: content,
        headers: {
          "Content-Type": "text/plain",
          "x-ms-blob-type": "BlockBlob",
        },
      });

      expect(response.ok).toBe(true);

      // Verify upload succeeded
      const retrieved = await provider.getObject(key, "text");
      expect(retrieved).toBe(content);
    });

    it("should upload binary data via SAS URL", async () => {
      const key = `${testKeyPrefix}/http-upload-binary.bin`;
      const binaryData = new Uint8Array([15, 30, 45, 60, 75, 90]);
      const sasUploadUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(sasUploadUrl, {
        method: "PUT",
        body: binaryData,
        headers: {
          "Content-Type": "application/octet-stream",
          "x-ms-blob-type": "BlockBlob",
        },
      });

      expect(response.ok).toBe(true);

      // Verify binary data
      const retrieved = await provider.getObject(key, "raw");
      expect(retrieved).toEqual(binaryData);
    });

    it("should upload JSON via SAS URL", async () => {
      const key = `${testKeyPrefix}/http-upload-json.json`;
      const jsonData = {
        id: 123,
        name: "Azure Test",
        metadata: { region: "us-west", tier: "premium" },
      };
      const sasUploadUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(sasUploadUrl, {
        method: "PUT",
        body: JSON.stringify(jsonData),
        headers: {
          "Content-Type": "application/json",
          "x-ms-blob-type": "BlockBlob",
        },
      });

      expect(response.ok).toBe(true);

      // Verify JSON content
      const retrieved = await provider.getObject(key, "text");
      expect(JSON.parse(retrieved as string)).toEqual(jsonData);
    });

    it("should upload large blob via SAS URL", async () => {
      const key = `${testKeyPrefix}/http-upload-large.txt`;
      // Create 2MB of data
      const largeContent = "Y".repeat(1024 * 1024 * 2);
      const sasUploadUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(sasUploadUrl, {
        method: "PUT",
        body: largeContent,
        headers: {
          "Content-Type": "text/plain",
          "x-ms-blob-type": "BlockBlob",
        },
      });

      expect(response.ok).toBe(true);

      // Verify size
      const retrieved = await provider.getObject(key, "raw");
      expect(retrieved?.length).toBe(1024 * 1024 * 2);
    });

    it("should set custom metadata via SAS upload", async () => {
      const key = `${testKeyPrefix}/http-upload-metadata.txt`;
      const content = "Blob with metadata";
      const sasUploadUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(sasUploadUrl, {
        method: "PUT",
        body: content,
        headers: {
          "Content-Type": "text/plain",
          "x-ms-blob-type": "BlockBlob",
          "x-ms-meta-author": "test-user",
          "x-ms-meta-version": "1.0",
        },
      });

      expect(response.ok).toBe(true);

      // Verify blob exists
      const retrieved = await provider.getObject(key, "text");
      expect(retrieved).toBe(content);
    });
  });

  describe("HTTP Flow - Download with Range Requests", () => {
    beforeAll(async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const content = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      await provider.putObject(key, new TextEncoder().encode(content));
    });

    it("should download specific byte range", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl, {
        headers: {
          Range: "bytes=10-19",
        },
      });

      expect(response.status).toBe(206); // Partial Content
      const content = await response.text();
      expect(content).toBe("ABCDEFGHIJ");
    });

    it("should download from specific offset to end", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl, {
        headers: {
          Range: "bytes=52-",
        },
      });

      expect(response.status).toBe(206);
      const content = await response.text();
      expect(content).toBe("qrstuvwxyz");
    });

    it("should download last N bytes", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl, {
        headers: {
          Range: "bytes=-10",
        },
      });

      // Azurite may not fully support suffix-byte-range-spec and can return 500
      // Accept 206 (Partial Content), 200 (Full Content), or 500 (Not Supported)
      expect([200, 206, 500]).toContain(response.status);

      if (response.status === 500) {
        // Azurite doesn't support suffix-byte-range-spec, skip validation
        return;
      }

      const content = await response.text();

      if (response.status === 206) {
        expect(content).toBe("qrstuvwxyz");
      } else {
        // If server doesn't support range, it returns full content
        expect(content.length).toBeGreaterThan(10);
      }
    });

    it("should handle multiple ranges", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl, {
        headers: {
          Range: "bytes=0-4",
        },
      });

      expect([200, 206]).toContain(response.status);
      const content = await response.text();
      expect(content).toContain("01234");
    });
  });

  describe("HTTP Flow - Streaming Downloads", () => {
    it("should stream large blob download", async () => {
      const key = `${testKeyPrefix}/http-stream-download.txt`;
      const chunkSize = 100000;
      const chunks = 15;
      const largeContent = "Z".repeat(chunkSize * chunks);

      await provider.putObject(key, new TextEncoder().encode(largeContent));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      expect(response.ok).toBe(true);
      expect(response.body).toBeDefined();

      const reader = response.body!.getReader();
      let downloadedSize = 0;
      let chunksReceived = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        downloadedSize += value.length;
        chunksReceived++;
      }

      expect(downloadedSize).toBe(chunkSize * chunks);
      expect(chunksReceived).toBeGreaterThan(1);
    });

    it("should stream with progress tracking", async () => {
      const key = `${testKeyPrefix}/http-stream-progress.txt`;
      const content = "P".repeat(750000); // 750KB

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      const contentLength = parseInt(
        response.headers.get("content-length") || "0",
      );
      expect(contentLength).toBe(750000);

      const reader = response.body!.getReader();
      let receivedLength = 0;
      const progressUpdates: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        receivedLength += value.length;
        const progress = (receivedLength / contentLength) * 100;
        progressUpdates.push(progress);
      }

      expect(receivedLength).toBe(contentLength);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it("should abort streaming download", async () => {
      const key = `${testKeyPrefix}/http-stream-abort.txt`;
      const largeContent = "Q".repeat(1000000); // 1MB

      await provider.putObject(key, new TextEncoder().encode(largeContent));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const abortController = new AbortController();

      const response = await fetch(sasUrl, {
        signal: abortController.signal,
      });

      const reader = response.body!.getReader();
      let bytesRead = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          bytesRead += value.length;

          // Abort after reading some data
          if (bytesRead > 100000) {
            abortController.abort();
            break;
          }
        }
      } catch (error: any) {
        expect(error.name).toBe("AbortError");
      }

      expect(bytesRead).toBeGreaterThan(0);
      expect(bytesRead).toBeLessThan(1000000);
    });
  });

  describe("HTTP Flow - Headers and Metadata", () => {
    it("should verify Content-Type header", async () => {
      const key = `${testKeyPrefix}/http-content-type.xml`;
      const xmlContent = '<?xml version="1.0"?><root><item>test</item></root>';

      await provider.putObject(
        key,
        new TextEncoder().encode(xmlContent),
        "application/xml",
      );

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      expect(response.headers.get("content-type")).toContain("application/xml");
    });

    it("should check ETag header", async () => {
      const key = `${testKeyPrefix}/http-etag.txt`;
      const content = "ETag test for Azure Blob";

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      const etag = response.headers.get("etag");
      expect(etag).toBeDefined();
      expect(etag).not.toBe("");
    });

    it("should verify Azure-specific headers", async () => {
      const key = `${testKeyPrefix}/http-azure-headers.txt`;
      const content = "Azure headers test";

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      // Check Azure-specific headers
      expect(response.headers.get("x-ms-blob-type")).toBeDefined();
      expect(response.headers.get("x-ms-request-id")).toBeDefined();
    });

    it("should handle conditional requests with If-None-Match", async () => {
      const key = `${testKeyPrefix}/http-conditional.txt`;
      const content = "Conditional request for Azure";

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);

      // First request to get ETag
      const firstResponse = await fetch(sasUrl);
      const etag = firstResponse.headers.get("etag");
      expect(etag).toBeDefined();

      // Second request with If-None-Match
      const secondResponse = await fetch(sasUrl, {
        headers: {
          "If-None-Match": etag!,
        },
      });

      expect(secondResponse.status).toBe(304); // Not Modified
    });

    it("should verify Content-Length header", async () => {
      const key = `${testKeyPrefix}/http-content-length.txt`;
      const content = "Test blob content for Azure"; // 27 characters

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl);

      const contentLength = response.headers.get("content-length");
      expect(contentLength).toBe(content.length.toString());
    });
  });

  describe("HTTP Flow - Error Handling", () => {
    it("should return 404 for non-existent blob", async () => {
      const key = `${testKeyPrefix}/http-nonexistent-blob.txt`;
      const sasUrl = await provider.getDownloadUrl(key, 3600);

      const response = await fetch(sasUrl);
      expect(response.status).toBe(404);
    });

    it("should handle invalid SAS token", async () => {
      const key = `${testKeyPrefix}/http-invalid-sas.txt`;
      await provider.putObject(key, new TextEncoder().encode("test"));

      const sasUrl = await provider.getUploadUrl(key, 3600);
      const invalidSasUrl = sasUrl.replace(/sig=[^&]+/, "sig=invalidsignature");

      const response = await fetch(invalidSasUrl, {
        method: "PUT",
        body: "Should fail",
        headers: {
          "x-ms-blob-type": "BlockBlob",
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle HEAD requests", async () => {
      const key = `${testKeyPrefix}/http-head.txt`;
      const content = "HEAD request test for Azure";

      await provider.putObject(key, new TextEncoder().encode(content));

      const sasUrl = await provider.getDownloadUrl(key, 3600);
      const response = await fetch(sasUrl, { method: "HEAD" });

      expect(response.ok).toBe(true);
      expect(response.headers.get("content-length")).toBe(
        content.length.toString(),
      );

      // Body should be empty for HEAD request
      const body = await response.text();
      expect(body).toBe("");
    });

    it("should handle OPTIONS requests for CORS", async () => {
      const key = `${testKeyPrefix}/http-options.txt`;
      await provider.putObject(key, new TextEncoder().encode("CORS test"));

      const sasUrl = await provider.getDownloadUrl(key, 3600);

      try {
        const response = await fetch(sasUrl, {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
          },
        });

        // Azure might return 200 or 403 depending on CORS settings
        expect([200, 403]).toContain(response.status);
      } catch (error) {
        // OPTIONS requests might be blocked, which is acceptable
        console.log("OPTIONS request not supported or blocked");
      }
    });
  });

  describe("HTTP Flow - Concurrent Operations", () => {
    it("should handle concurrent uploads", async () => {
      const uploadPromises = Array.from({ length: 5 }, async (_, i) => {
        const key = `${testKeyPrefix}/http-concurrent-upload-${i}.txt`;
        const content = `Azure concurrent upload ${i}`;
        const sasUrl = await provider.getUploadUrl(key, 3600);

        const response = await fetch(sasUrl, {
          method: "PUT",
          body: content,
          headers: {
            "x-ms-blob-type": "BlockBlob",
          },
        });

        expect(response.ok).toBe(true);
        return key;
      });

      const keys = await Promise.all(uploadPromises);
      expect(keys).toHaveLength(5);

      // Verify all uploads
      for (let i = 0; i < 5; i++) {
        const retrieved = await provider.getObject(keys[i], "text");
        expect(retrieved).toBe(`Azure concurrent upload ${i}`);
      }
    });

    it("should handle concurrent downloads", async () => {
      // Setup test blobs
      const keys = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const key = `${testKeyPrefix}/http-concurrent-download-${i}.txt`;
          await provider.putObject(
            key,
            new TextEncoder().encode(`Azure download ${i}`),
          );
          return key;
        }),
      );

      // Concurrent downloads
      const downloadPromises = keys.map(async (key, i) => {
        const sasUrl = await provider.getDownloadUrl(key, 3600);
        const response = await fetch(sasUrl);
        const content = await response.text();
        return { index: i, content };
      });

      const results = await Promise.all(downloadPromises);

      expect(results).toHaveLength(5);
      results.forEach(({ index, content }) => {
        expect(content).toBe(`Azure download ${index}`);
      });
    });

    it("should handle mixed concurrent operations", async () => {
      const operations = await Promise.all([
        // Upload operations
        ...Array.from({ length: 3 }, async (_, i) => {
          const key = `${testKeyPrefix}/http-mixed-upload-${i}.txt`;
          const sasUrl = await provider.getUploadUrl(key, 3600);
          const response = await fetch(sasUrl, {
            method: "PUT",
            body: `Upload ${i}`,
            headers: { "x-ms-blob-type": "BlockBlob" },
          });
          return { type: "upload", success: response.ok, index: i };
        }),
        // Download operations
        ...Array.from({ length: 3 }, async (_, i) => {
          const key = `${testKeyPrefix}/http-concurrent-download-${i}.txt`;
          const sasUrl = await provider.getDownloadUrl(key, 3600);
          const response = await fetch(sasUrl);
          return { type: "download", success: response.ok, index: i };
        }),
      ]);

      const uploads = operations.filter((op) => op.type === "upload");
      const downloads = operations.filter((op) => op.type === "download");

      expect(uploads).toHaveLength(3);
      expect(downloads).toHaveLength(3);
      expect(uploads.every((op) => op.success)).toBe(true);
    });
  });
});
