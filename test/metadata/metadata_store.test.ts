import { describe, it, expect, beforeEach } from "vitest";
import { MetadataStore } from "../../src/metadata_store.js";

describe("MetadataStore", () => {
  class TestTarget {}

  beforeEach(() => {
    // Clear any previous metadata
    MetadataStore.clear(TestTarget);
    MetadataStore.clear(TestTarget.prototype);
  });

  it("should persist Map when using getOrCreateAll", () => {
    const target = new TestTarget();
    const map1 = MetadataStore.getOrCreateAll(target);

    // Mutate the map
    map1.set("key1", "value1");

    // Get the map again - should be the same instance
    const map2 = MetadataStore.getOrCreateAll(target);

    expect(map2).toBe(map1);
    expect(map2.get("key1")).toBe("value1");
  });

  it("should create new Map for different targets", () => {
    const target1 = new TestTarget();
    const target2 = new TestTarget();

    const map1 = MetadataStore.getOrCreateAll(target1);
    const map2 = MetadataStore.getOrCreateAll(target2);

    expect(map1).not.toBe(map2);

    map1.set("key", "value1");
    map2.set("key", "value2");

    expect(map1.get("key")).toBe("value1");
    expect(map2.get("key")).toBe("value2");
  });

  it("should allow metadata accumulation via getOrCreateAll", () => {
    const target = new TestTarget();

    const map1 = MetadataStore.getOrCreateAll(target);
    map1.set("route", "/api/users");

    const map2 = MetadataStore.getOrCreateAll(target);
    map2.set("method", "GET");

    const map3 = MetadataStore.getOrCreateAll(target);

    expect(map3.get("route")).toBe("/api/users");
    expect(map3.get("method")).toBe("GET");
    expect(map3.size).toBe(2);
  });

  it("should work with set and get methods", () => {
    const target = new TestTarget();

    MetadataStore.set(target, "key1", "value1");
    MetadataStore.set(target, "key2", "value2");

    expect(MetadataStore.get(target, "key1")).toBe("value1");
    expect(MetadataStore.get(target, "key2")).toBe("value2");

    const map = MetadataStore.getAll(target);
    expect(map).toBeDefined();
    expect(map!.size).toBe(2);
  });

  it("should support Symbol keys", () => {
    const target = new TestTarget();
    const symbolKey = Symbol("test");

    MetadataStore.set(target, symbolKey, "symbol-value");

    expect(MetadataStore.get(target, symbolKey)).toBe("symbol-value");

    const map = MetadataStore.getAll(target);
    expect(map).toBeDefined();
    expect(map!.get(symbolKey)).toBe("symbol-value");
  });

  it("should delete specific metadata", () => {
    const target = new TestTarget();

    MetadataStore.set(target, "key1", "value1");
    MetadataStore.set(target, "key2", "value2");

    MetadataStore.delete(target, "key1");

    expect(MetadataStore.get(target, "key1")).toBeUndefined();
    expect(MetadataStore.get(target, "key2")).toBe("value2");
  });

  it("should clear all metadata for target", () => {
    const target = new TestTarget();

    MetadataStore.set(target, "key1", "value1");
    MetadataStore.set(target, "key2", "value2");

    MetadataStore.clear(target);

    const map = MetadataStore.getAll(target);
    expect(map).toBeUndefined();
  });

  it("should handle non-existent target gracefully", () => {
    const target = new TestTarget();

    expect(MetadataStore.get(target, "nonexistent")).toBeUndefined();

    // getAll returns undefined for non-existent targets
    const map = MetadataStore.getAll(target);
    expect(map).toBeUndefined();

    // getOrCreateAll creates an empty Map for non-existent targets
    const createdMap = MetadataStore.getOrCreateAll(target);
    expect(createdMap).toBeInstanceOf(Map);
    expect(createdMap.size).toBe(0);
  });

  it("should support metadata on class prototypes", () => {
    MetadataStore.set(TestTarget.prototype, "classMethod", "GET");

    const instance1 = new TestTarget();
    const instance2 = new TestTarget();

    // Instances share the prototype metadata
    expect(MetadataStore.get(TestTarget.prototype, "classMethod")).toBe("GET");

    // But instances can have their own metadata
    MetadataStore.set(instance1, "instanceData", "instance1");
    MetadataStore.set(instance2, "instanceData", "instance2");

    expect(MetadataStore.get(instance1, "instanceData")).toBe("instance1");
    expect(MetadataStore.get(instance2, "instanceData")).toBe("instance2");
  });
});
