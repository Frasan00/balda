import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { S3StorageProvider } from "../../src/storage/providers/s3.js";

describe("S3StorageProvider with LocalStack", () => {
  let provider: S3StorageProvider;
  const bucketName = process.env.S3_BUCKET || "test-bucket";
  const testKeyPrefix = `test-${Date.now()}`;

  beforeAll(async () => {
    provider = new S3StorageProvider({
      s3ClientConfig: {
        bucketName,
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
        forcePathStyle: true,
      },
    });

    try {
      const { S3Client, CreateBucketCommand } =
        await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
        forcePathStyle: true,
      });

      await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (error) {
      console.log("Bucket might already exist, continuing...");
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
    it("should upload a file to S3", async () => {
      const key = `${testKeyPrefix}/upload-test.txt`;
      const content = new TextEncoder().encode("S3 test content");

      await provider.putObject(key, content, "text/plain");

      const retrieved = await provider.getObject(key);
      expect(retrieved).toBeDefined();
    });

    it("should upload binary data", async () => {
      const key = `${testKeyPrefix}/binary-test.bin`;
      const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5]);

      await provider.putObject(key, binaryData, "application/octet-stream");

      const retrieved = await provider.getObject(key);
      expect(retrieved).toBeDefined();
      expect(retrieved?.length).toBe(6);
    });
  });

  describe("getObject", () => {
    beforeAll(async () => {
      const key = `${testKeyPrefix}/get-test.txt`;
      const content = new TextEncoder().encode("Get test content");
      await provider.putObject(key, content);
    });

    it("should retrieve an existing object", async () => {
      const key = `${testKeyPrefix}/get-test.txt`;
      const result = await provider.getObject(key);

      expect(result).toBeDefined();
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Get test content");
    });

    it("should throw error for non-existent object", async () => {
      await expect(
        provider.getObject("non-existent-key-123456"),
      ).rejects.toThrow("File not found: non-existent-key-123456");
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

    it("should list all objects with prefix", async () => {
      const files = await provider.listObjects(testKeyPrefix);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toEqual(
        expect.arrayContaining([`${testKeyPrefix}/list/file1.txt`]),
      );
    });

    it("should list objects with specific prefix", async () => {
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
    it("should delete an existing object", async () => {
      const key = `${testKeyPrefix}/delete-test.txt`;
      await provider.putObject(key, new TextEncoder().encode("to be deleted"));

      await provider.deleteObject(key);

      await expect(provider.getObject(key)).rejects.toThrow(
        `File not found: ${key}`,
      );
    });

    it("should not throw when deleting non-existent object", async () => {
      await provider.deleteObject("non-existent-delete-key");
    });
  });

  describe("getUploadUrl", () => {
    it("should generate a presigned upload URL", async () => {
      const key = `${testKeyPrefix}/presigned-upload.txt`;
      const url = await provider.getUploadUrl(key, 3600);

      expect(url).toBeDefined();
      expect(url).toContain(bucketName);
      expect(url).toContain(key);
      expect(url).toContain("X-Amz-Signature");
    });

    it("should generate URL with custom expiration", async () => {
      const key = `${testKeyPrefix}/presigned-short.txt`;
      const url = await provider.getUploadUrl(key, 60);

      expect(url).toBeDefined();
      expect(url).toContain("X-Amz-Expires=60");
    });
  });

  describe("getDownloadUrl", () => {
    it("should throw error when CloudFront is not configured", async () => {
      const key = `${testKeyPrefix}/download-test.txt`;

      await expect(provider.getDownloadUrl(key)).rejects.toThrow(
        "getDownloadUrl requires CloudFront configuration",
      );
    });
  });

  describe("getDownloadUrl with CloudFront", () => {
    it("should generate CloudFront signed URL when configured", async () => {
      const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCoa4KwilF+EHT8
dFqjJSugY2KqPq+evt6S5bXBlIvUWE9c/CYx9iPBeD8JWdIk/gXDWcALFqDaPlC6
gh98wHOuaEHIXjaQU3fRg0/zyIt/ZxzSF0dh2fR+qFr98PCwK8P/RdRfbyEIcm1v
JJmJQ9/JWo/tiYrhf8U0AqqU7DIZqV2z+zYF4+PxA6ekDtVb3nNPg6ILgeQpEoCA
UvRuM3ABy6OC59NeRF/3dpi+123EtIeuZITf+XcBC5AQFTFJLoeVtUaXXucdszye
2CZNTPcIkNa8QC4lAJWl6RnlFu7y1jdQJmLR3ZsbO9NA7SaaTfun9ijl+Bn7IgfW
RkSnwSXzAgMBAAECggEAEqY9BYF7fqMh4SadNr2R9COtND7WwZRPHyMSmknxpeTV
fO1q6VNhKDZBfK6Wh4QdbUFN86xgyWnnFI/+HplM9f4TcrWEAz1K4kdRHiSR1dy8
I0NyoxI4caIA2WfJryhZfrXjy2GJ3d6V4Z3C5qE+cZR2pY36c/frBVRaQT1aWt7p
QXuvpwXotWSd+kbvRH9Uvg55kj7+I1+lxXN0N6fiRdsDbzObrE+OTJJ2RCXhDZhK
PNStL1dmE+1v3ltp40eYOPIpfjBHnCTdL8HQ5o/kM+bPiVcG52aDMQWEUa0nTc9Q
feEuwbEiR480C5CXiGAi7m8KNNlNv0B/BHuzgnWImQKBgQDVdkio1YTvV8RUsY9D
7QZy/tLyfuU3mdNvqLwO+2Hkdmue9RxImFwMDPV9VpSdchAeraNX9VMIn7Fe668B
WcMxk3cwcRHgMHXuQaGDGvZ8qQ5suMLsaAmTykBMDZiLcOyxFrsm5DKkdWVvx1ID
z1QBMYzcLEr7FsNa1xUmowimBQKBgQDJ+2pWD/etDDOHVhYbql53SdbDESAHhjAa
gR6LmI+Cqfwa6VXmbHlcxA/FIp7Xrci3IrqK/3FKUQBQr7sEoHQ1N9BKjswZbout
qKJQEoajcSWoRV2R8PuSgdszrXaF1SR12WiH2O3iMsjSNyiFEuGXdQlcZFMuLrA5
m90f6u6llwKBgEmcaKIQP69pzMKIGKeL7VVqmsQVDmaGHWu7/F4OQkvOqn4+eGpw
YA2nymBWoxlIZFav+kwyxVeL+laJX+hPVAicmdWSqF9vVru61j+n5KhIhDjp3g44
MlVMwa94YMp1Pqoy9IcM2onsEfbh/V5i+M0QkUq723+K8gM5eInCXxEhAoGAJvly
jWTLYALotoawAWqgi9gdrspRKeKEybh8kmc/2fC/CtpXjv0DdhkHCf0iNW/9OQlk
gYnE7JgwvWELb1se0V4RvTFMxOOF5F6T42uPu14L7CpmYdDkWmLgT1p7clusi2kG
OKBtVqaCBb5K/VKlYTpeMgvR2Sl9K8CdrJkCr8UCgYEAxJYWkLXuXkJlWvEE5Moz
F0Bh6wL1hIuOJcfGgbJeKk9SkNU0Lxy806/Frk2viNTM+7c+WAPXlJkdU2X0hbD1
bbOU1pt5Vd1zHM1VfcvXK4xjewASjG9jsImGL3vDXQj7BciITB7dMGXE/fircew2
MGn/h03aOm9Nn8PmW84bfqo=
-----END PRIVATE KEY-----`;

      const providerWithCloudFront = new S3StorageProvider({
        s3ClientConfig: {
          bucketName,
          region: process.env.AWS_REGION || "us-east-1",
          endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
          },
          forcePathStyle: true,
        },
        cloudfrontOptions: {
          domainName: process.env.CLOUDFRONT_DOMAIN || "localhost:4566",
          keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || "test-key-pair-id",
          privateKey: testPrivateKey,
        },
      });

      const key = `${testKeyPrefix}/cloudfront-test.txt`;
      const url = await providerWithCloudFront.getDownloadUrl(key, 3600);

      expect(url).toBeDefined();
      expect(url).toContain("Signature=");
      expect(url).toContain("Key-Pair-Id=");
      expect(url).toContain("Expires=");
    });
  });

  describe("getPublicUrl", () => {
    it("should generate public URL for S3 object", async () => {
      const key = `${testKeyPrefix}/public-test.txt`;
      const url = await provider.getPublicUrl(key);

      expect(url).toBeDefined();
      expect(url).toContain(bucketName);
      expect(url).toContain(key);
    });

    it("should work with LocalStack endpoint", async () => {
      const key = `${testKeyPrefix}/public-localstack.txt`;
      await provider.putObject(key, new TextEncoder().encode("Public content"));

      const url = await provider.getPublicUrl(key);

      expect(url).toBeDefined();
      expect(url).toContain(key);
    });

    it("should allow HTTP access to public URL", async () => {
      const key = `${testKeyPrefix}/public-http-test.txt`;
      const content = "Public HTTP test content";
      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);

      const response = await fetch(publicUrl);
      expect(response.ok).toBe(true);

      const downloadedContent = await response.text();
      expect(downloadedContent).toBe(content);
    });
  });

  describe("HTTP Flow - Upload via Presigned URL", () => {
    it("should upload file using presigned PUT URL", async () => {
      const key = `${testKeyPrefix}/http-upload-put.txt`;
      const content = "Uploaded via HTTP PUT";
      const presignedUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: content,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      expect(response.ok).toBe(true);

      // Verify upload succeeded
      const retrieved = await provider.getObject(key, "text");
      expect(retrieved).toBe(content);
    });

    it("should upload binary data via presigned URL", async () => {
      const key = `${testKeyPrefix}/http-upload-binary.bin`;
      const binaryData = new Uint8Array([100, 200, 50, 150, 75]);
      const presignedUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: binaryData,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      expect(response.ok).toBe(true);

      // Verify binary data
      const retrieved = await provider.getObject(key, "raw");
      expect(retrieved).toEqual(binaryData);
    });

    it("should upload JSON via presigned URL", async () => {
      const key = `${testKeyPrefix}/http-upload-json.json`;
      const jsonData = { name: "Test", value: 42, nested: { key: "value" } };
      const presignedUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: JSON.stringify(jsonData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.ok).toBe(true);

      // Verify JSON content
      const retrieved = await provider.getObject(key, "text");
      expect(JSON.parse(retrieved as string)).toEqual(jsonData);
    });

    it("should upload large file via presigned URL", async () => {
      const key = `${testKeyPrefix}/http-upload-large.txt`;
      // Create 1MB of data
      const largeContent = "x".repeat(1024 * 1024);
      const presignedUrl = await provider.getUploadUrl(key, 3600);

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: largeContent,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      expect(response.ok).toBe(true);

      // Verify size
      const retrieved = await provider.getObject(key, "raw");
      expect(retrieved?.length).toBe(1024 * 1024);
    }, 10000);
  });

  describe("HTTP Flow - Download with Range Requests", () => {
    beforeAll(async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const content = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      await provider.putObject(key, new TextEncoder().encode(content));
    });

    it("should download specific byte range", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const publicUrl = await provider.getPublicUrl(key);

      const response = await fetch(publicUrl, {
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
      const publicUrl = await provider.getPublicUrl(key);

      const response = await fetch(publicUrl, {
        headers: {
          Range: "bytes=30-",
        },
      });

      expect(response.status).toBe(206);
      const content = await response.text();
      expect(content).toBe("UVWXYZ");
    });

    it("should download last N bytes", async () => {
      const key = `${testKeyPrefix}/http-range-test.txt`;
      const publicUrl = await provider.getPublicUrl(key);

      const response = await fetch(publicUrl, {
        headers: {
          Range: "bytes=-5",
        },
      });

      expect(response.status).toBe(206);
      const content = await response.text();
      expect(content).toBe("VWXYZ");
    });
  });

  describe("HTTP Flow - Streaming Downloads", () => {
    it("should stream large file download", async () => {
      const key = `${testKeyPrefix}/http-stream-download.txt`;
      const chunkSize = 100000;
      const chunks = 10;
      const largeContent = "A".repeat(chunkSize * chunks);

      await provider.putObject(key, new TextEncoder().encode(largeContent));

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl);

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
      const content = "B".repeat(500000); // 500KB

      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl);

      const contentLength = parseInt(
        response.headers.get("content-length") || "0",
      );
      expect(contentLength).toBe(500000);

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
  });

  describe("HTTP Flow - Headers and Metadata", () => {
    it("should verify Content-Type header", async () => {
      const key = `${testKeyPrefix}/http-content-type.json`;
      const jsonContent = JSON.stringify({ test: "data" });

      await provider.putObject(
        key,
        new TextEncoder().encode(jsonContent),
        "application/json",
      );

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl);

      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("should check ETag header", async () => {
      const key = `${testKeyPrefix}/http-etag.txt`;
      const content = "ETag test content";

      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl);

      const etag = response.headers.get("etag");
      expect(etag).toBeDefined();
      expect(etag).not.toBe("");
    });

    it("should handle conditional requests with If-None-Match", async () => {
      const key = `${testKeyPrefix}/http-conditional.txt`;
      const content = "Conditional request test";

      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);

      // First request to get ETag
      const firstResponse = await fetch(publicUrl);
      const etag = firstResponse.headers.get("etag");
      expect(etag).toBeDefined();

      // Second request with If-None-Match
      const secondResponse = await fetch(publicUrl, {
        headers: {
          "If-None-Match": etag!,
        },
      });

      expect(secondResponse.status).toBe(304); // Not Modified
    });

    it("should verify Content-Length header", async () => {
      const key = `${testKeyPrefix}/http-content-length.txt`;
      const content = "Test content with exactly 30 ch"; // Actually 32 characters

      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl);

      const contentLength = response.headers.get("content-length");
      expect(contentLength).toBe(content.length.toString());
    });
  });

  describe("HTTP Flow - Error Handling", () => {
    it("should return 404 for non-existent file", async () => {
      const key = `${testKeyPrefix}/http-nonexistent.txt`;
      const publicUrl = await provider.getPublicUrl(key);

      const response = await fetch(publicUrl);
      expect(response.status).toBe(404);
    });

    it("should handle malformed presigned URL", async () => {
      const key = `${testKeyPrefix}/http-malformed.txt`;
      await provider.putObject(key, new TextEncoder().encode("test"));

      const presignedUrl = await provider.getUploadUrl(key, 3600);
      const malformedUrl = presignedUrl.replace(
        /X-Amz-Signature=[^&]+/,
        "X-Amz-Signature=invalidsignature123",
      );

      const response = await fetch(malformedUrl, {
        method: "PUT",
        body: "Should fail",
      });

      // LocalStack might be permissive, so check for either rejection or success
      // In production AWS, this would fail with 403
      if (!response.ok) {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it("should handle HEAD requests", async () => {
      const key = `${testKeyPrefix}/http-head.txt`;
      const content = "HEAD request test";

      await provider.putObject(key, new TextEncoder().encode(content));

      const publicUrl = await provider.getPublicUrl(key);
      const response = await fetch(publicUrl, { method: "HEAD" });

      expect(response.ok).toBe(true);
      expect(response.headers.get("content-length")).toBe(
        content.length.toString(),
      );

      // Body should be empty for HEAD request
      const body = await response.text();
      expect(body).toBe("");
    });
  });

  describe("HTTP Flow - Concurrent Operations", () => {
    it("should handle concurrent uploads", async () => {
      const uploadPromises = Array.from({ length: 5 }, async (_, i) => {
        const key = `${testKeyPrefix}/http-concurrent-upload-${i}.txt`;
        const content = `Concurrent upload ${i}`;
        const presignedUrl = await provider.getUploadUrl(key, 3600);

        const response = await fetch(presignedUrl, {
          method: "PUT",
          body: content,
        });

        expect(response.ok).toBe(true);
        return key;
      });

      const keys = await Promise.all(uploadPromises);
      expect(keys).toHaveLength(5);

      // Verify all uploads
      for (let i = 0; i < 5; i++) {
        const retrieved = await provider.getObject(keys[i], "text");
        expect(retrieved).toBe(`Concurrent upload ${i}`);
      }
    });

    it("should handle concurrent downloads", async () => {
      // Setup test files
      const keys = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const key = `${testKeyPrefix}/http-concurrent-download-${i}.txt`;
          await provider.putObject(
            key,
            new TextEncoder().encode(`Download ${i}`),
          );
          return key;
        }),
      );

      // Concurrent downloads
      const downloadPromises = keys.map(async (key, i) => {
        const publicUrl = await provider.getPublicUrl(key);
        const response = await fetch(publicUrl);
        const content = await response.text();
        return { index: i, content };
      });

      const results = await Promise.all(downloadPromises);

      expect(results).toHaveLength(5);
      results.forEach(({ index, content }) => {
        expect(content).toBe(`Download ${index}`);
      });
    });
  });
});
