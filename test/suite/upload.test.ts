import { describe, expect, it } from "vitest";
import { mockServer } from "../server/instance.js";

describe("FileUploadController", () => {
  it("POST /file/upload returns file info for valid upload", async () => {
    const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
    const formData = new FormData();
    formData.append("file", new Blob([uint8Array]), "test.txt");

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
    expect(res.body()).toEqual({
      originalName: "test.txt",
      filename: "file",
      size: 5,
      mimetype: "application/octet-stream",
      otherFields: {},
    });
  });

  it("sanitizes filenames with path traversal attempts", async () => {
    const uint8Array = new Uint8Array([1, 2, 3]);
    const formData = new FormData();
    formData.append("file", new Blob([uint8Array]), "../../etc/passwd");

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
    const body = res.body();
    expect(body.originalName).toBe("../../etc/passwd");
  });

  it("handles multiple files in single request", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array([1, 2])]), "file1.txt");
    formData.append("file2", new Blob([new Uint8Array([3, 4])]), "file2.txt");

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
  });

  it("handles files with null bytes in filename", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array([1])]), "test\0.txt");

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
  });

  it("handles files with control characters in filename", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array([1])]),
      "test\x00\x1f.txt",
    );

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
  });
});
