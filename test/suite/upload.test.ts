import { describe, it, expect } from "vitest";
import { mockServer } from "test/server";

describe("FileUploadController", () => {
  it("POST /file/upload returns all users", async () => {
    const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
    const formData = new FormData();
    formData.append("file", new Blob([uint8Array]), "test.txt");

    const res = await mockServer.post("/file/upload", {
      formData,
    });

    expect(res.assertStatus(200));
    console.log(res.body());
    expect(res.body()).toEqual({
      originalName: "test.txt",
      filename: "file",
      size: 5,
      mimetype: "application/octet-stream",
      otherFields: {},
    });
  });
});
