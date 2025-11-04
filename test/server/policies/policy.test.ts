import { describe, expect, it } from "vitest";
import { policyManager } from "../instance";

describe("Test Policy", () => {
  it("should return true if the user is an admin", async () => {
    expect(
      await policyManager.canAccess("test", "adminRoute", {
        id: "1",
        name: "John",
        role: "admin",
      }),
    ).toBe(true);
  });

  it("should return false if the user is not an admin", async () => {
    expect(
      await policyManager.canAccess("test", "adminRoute", {
        id: "1",
        name: "John",
        role: "user",
      }),
    ).toBe(false);
  });
});
