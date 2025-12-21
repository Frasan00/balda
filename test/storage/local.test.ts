import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nativeFs } from "../../src/runtime/native_fs.js";
import { nativePath } from "../../src/runtime/native_path.js";
import { LocalStorageProvider } from "../../src/storage/providers/local.js";

describe("LocalStorageProvider", () => {
  const testDir = nativePath.resolve("./test-storage-local");
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    provider = new LocalStorageProvider({
      directory: testDir,
    });

    await nativeFs.mkdir(testDir, { recursive: true });
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

  describe("putObject", () => {
    it("should store a file in the local filesystem", async () => {
      const key = "test-file.txt";
      const content = new TextEncoder().encode("Hello, World!");

      await provider.putObject(key, content, "text/plain");

      const filePath = nativePath.join(testDir, key);
      const exists = await nativeFs.exists(filePath);
      expect(exists).toBe(true);
    });

    it("should create nested directories automatically", async () => {
      const key = "folder/subfolder/nested-file.txt";
      const content = new TextEncoder().encode("Nested content");

      await provider.putObject(key, content);

      const filePath = nativePath.join(testDir, key);
      const exists = await nativeFs.exists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe("getObject", () => {
    it("should retrieve a stored file", async () => {
      const key = "retrieve-test.txt";
      const originalContent = new TextEncoder().encode("Test content");

      await provider.putObject(key, originalContent);
      const retrieved = await provider.getObject(key, "raw");

      expect(retrieved).toBeDefined();
      const retrievedText = new TextDecoder().decode(retrieved);
      expect(retrievedText).toBe("Test content");
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        provider.getObject("non-existent-file.txt", "raw"),
      ).rejects.toThrow("File not found: non-existent-file.txt");
    });

    it("should retrieve as raw Uint8Array (default return type)", async () => {
      const key = "raw-test.txt";
      const content = new TextEncoder().encode("Raw data test");

      await provider.putObject(key, content);
      const result = await provider.getObject(key, "raw");

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      expect(text).toBe("Raw data test");
    });

    it("should retrieve as text string", async () => {
      const key = "text-test.txt";
      const content = new TextEncoder().encode("Text return type test");

      await provider.putObject(key, content);
      const result = await provider.getObject(key, "text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toBe("Text return type test");
    });

    it("should retrieve as ReadableStream", async () => {
      const key = "stream-test.txt";
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
      await provider.putObject("list/file1.txt", new TextEncoder().encode("1"));
      await provider.putObject("list/file2.txt", new TextEncoder().encode("2"));
      await provider.putObject(
        "list/subfolder/file3.txt",
        new TextEncoder().encode("3"),
      );
      await provider.putObject(
        "other/file4.txt",
        new TextEncoder().encode("4"),
      );
    });

    it("should list all files without prefix", async () => {
      const files = await provider.listObjects();
      expect(files.length).toBeGreaterThan(0);
      expect(files).toEqual(expect.arrayContaining(["list/file1.txt"]));
    });

    it("should list files with prefix", async () => {
      const files = await provider.listObjects("list");
      expect(files.length).toBe(3);
      expect(files).toEqual(
        expect.arrayContaining([
          "list/file1.txt",
          "list/file2.txt",
          "list/subfolder/file3.txt",
        ]),
      );
    });

    it("should return empty array for non-existent prefix", async () => {
      const files = await provider.listObjects("non-existent");
      expect(files).toEqual([]);
    });
  });

  describe("deleteObject", () => {
    it("should delete an existing file", async () => {
      const key = "delete-test.txt";
      await provider.putObject(key, new TextEncoder().encode("to be deleted"));

      await provider.deleteObject(key);

      await expect(provider.getObject(key, "raw")).rejects.toThrow(
        "File not found: delete-test.txt",
      );
    });

    it("should not throw when deleting non-existent file", async () => {
      await provider.deleteObject("non-existent.txt");
    });
  });

  describe("getDownloadUrl", () => {
    it("should throw error - not supported", async () => {
      await expect(provider.getDownloadUrl("test.txt")).rejects.toThrow(
        "LocalStorageProvider does not support getDownloadUrl",
      );
    });
  });

  describe("getUploadUrl", () => {
    it("should throw error - not supported", async () => {
      await expect(provider.getUploadUrl("test.txt")).rejects.toThrow(
        "LocalStorageProvider does not support getUploadUrl",
      );
    });
  });

  describe("getPublicUrl", () => {
    it("should throw error - not supported", async () => {
      await expect(provider.getPublicUrl("test.txt")).rejects.toThrow(
        "`getPublicUrl` is not available in local storage provider",
      );
    });
  });
});
