import { MetadataStore } from "src/metadata_store";
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

describe("Test Policy Decorator", () => {
  const policy = policyManager.createDecorator();

  it("should store policy metadata on a class", () => {
    @policy("test", "adminRoute")
    class TestController {}

    const meta = MetadataStore.get(TestController.prototype, "__class__");
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(1);
    expect(meta.policies[0]).toEqual({
      scope: "test",
      handler: "adminRoute",
      manager: policyManager,
    });
  });

  it("should store policy metadata on a method", () => {
    class TestController {
      @policy("test", "adminRoute")
      getUser() {
        return { id: "1" };
      }
    }

    const meta = MetadataStore.get(TestController.prototype, "getUser");
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(1);
    expect(meta.policies[0]).toEqual({
      scope: "test",
      handler: "adminRoute",
      manager: policyManager,
    });
  });

  it("should accumulate multiple policies on a class", () => {
    @policy("test", "adminRoute")
    @policy("test", "adminRoute")
    class MultiPolicyController {}

    const meta = MetadataStore.get(
      MultiPolicyController.prototype,
      "__class__",
    );
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(2);
  });

  it("should accumulate multiple policies on a method", () => {
    class MultiPolicyMethodController {
      @policy("test", "adminRoute")
      @policy("test", "adminRoute")
      getUser() {
        return { id: "1" };
      }
    }

    const meta = MetadataStore.get(
      MultiPolicyMethodController.prototype,
      "getUser",
    );
    expect(meta).toBeDefined();
    expect(meta.policies).toHaveLength(2);
  });
});
