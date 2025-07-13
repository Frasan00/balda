import { describe, it, expect } from "vitest";
import { mockServer } from "test/server";

describe("UrlencodedController", () => {
  it("POST /urlencoded returns all users", async () => {
    const res = await mockServer.post("/urlencoded", {
      urlencoded: {
        name: "John Doe",
        age: "30",
        email: "john.doe@example.com",
      },
    });

    expect(res.assertStatus(200));
    expect(res.body()).toEqual({
      name: "John Doe",
      age: "30",
      email: "john.doe@example.com",
    });
  });
});
