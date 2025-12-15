import { Server } from "../../src/index.js";
import { beforeEach, describe, expect, it } from "vitest";

describe("Server Embedding Functions", () => {
  let server: Server<"http">;

  beforeEach(() => {
    server = new Server();
  });

  describe("embed method", () => {
    it("should embed a string value", () => {
      server.embed("customString", "test-value");

      expect((server as any).customString).toBe("test-value");
    });

    it("should embed a number value", () => {
      server.embed("customNumber", 42);

      expect((server as any).customNumber).toBe(42);
    });

    it("should embed a boolean value", () => {
      server.embed("customBoolean", true);

      expect((server as any).customBoolean).toBe(true);
    });

    it("should embed an object value", () => {
      const customObject = { key: "value", nested: { prop: "val" } };
      server.embed("customObject", customObject);

      expect((server as any).customObject).toEqual(customObject);
    });

    it("should embed an array value", () => {
      const customArray = [1, 2, 3, "test"];
      server.embed("customArray", customArray);

      expect((server as any).customArray).toEqual(customArray);
    });

    it("should embed a function value", () => {
      const customFunction = () => "test";
      server.embed("customFunction", customFunction);

      expect((server as any).customFunction).toBe(customFunction);
      expect((server as any).customFunction()).toBe("test");
    });

    it("should embed null value", () => {
      server.embed("customNull", null);

      expect((server as any).customNull).toBe(null);
    });

    it("should embed undefined value", () => {
      server.embed("customUndefined", undefined);

      expect((server as any).customUndefined).toBe(undefined);
    });

    it("should embed complex nested objects", () => {
      const complexObject = {
        users: [
          { id: 1, name: "John", settings: { theme: "dark" } },
          { id: 2, name: "Jane", settings: { theme: "light" } },
        ],
        config: {
          api: { baseUrl: "https://api.example.com" },
          db: { connectionString: "postgresql://..." },
        },
      };

      server.embed("complexObject", complexObject);

      expect((server as any).complexObject).toEqual(complexObject);
    });

    it("should embed multiple values", () => {
      server.embed("value1", "first");
      server.embed("value2", "second");
      server.embed("value3", "third");

      expect((server as any).value1).toBe("first");
      expect((server as any).value2).toBe("second");
      expect((server as any).value3).toBe("third");
    });

    it("should make embedded properties configurable", () => {
      server.embed("configurableValue", "test");

      // Should be able to delete the property
      expect(() => {
        delete (server as any).configurableValue;
      }).not.toThrow();
    });

    it("should make embedded properties enumerable", () => {
      server.embed("enumerableValue", "test");

      const keys = Object.keys(server);
      expect(keys).toContain("enumerableValue");
    });
  });

  describe("embed error handling", () => {
    it("should throw error for empty key", () => {
      expect(() => {
        server.embed("", "value");
      }).toThrow("Invalid key provided to embed");
    });

    it("should throw error for whitespace-only key", () => {
      expect(() => {
        server.embed("   ", "value");
      }).toThrow("Invalid key provided to embed");
    });

    it("should throw error for non-string key", () => {
      expect(() => {
        // @ts-expect-error - Testing runtime behavior with invalid inputs
        server.embed(null, "value");
      }).toThrow("Invalid key provided to embed");
    });

    it("should throw error for protected keys", () => {
      const protectedKeys = [
        "isListening",
        "url",
        "port",
        "host",
        "routes",
        "embed",
        "constructor",
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "getNodeServer",
        "getBunServer",
        "getDenoServer",
        "use",
        "setErrorHandler",
        "listen",
        "close",
        "tapOptions",
        "startUpOptions",
        "tmpDir",
        "logger",
        "getMockServer",
      ];

      protectedKeys.forEach((key) => {
        expect(() => {
          server.embed(key, "value");
        }).toThrow(
          `Cannot embed value with key '${key}' as it conflicts with a protected server property`,
        );
      });
    });

    it("should throw error for undefined key", () => {
      expect(() => {
        // @ts-expect-error - Testing runtime behavior with invalid inputs
        server.embed(undefined, "value");
      }).toThrow("Invalid key provided to embed");
    });

    it("should throw error for numeric key", () => {
      expect(() => {
        // @ts-expect-error - Testing runtime behavior with invalid inputs
        server.embed(123, "value");
      }).toThrow("Invalid key provided to embed");
    });
  });

  describe("embed with special characters", () => {
    it("should handle keys with special characters", () => {
      const specialKeys = [
        "key-with-dash",
        "key_with_underscore",
        "key.with.dot",
        "key@with@at",
        "key#with#hash",
        "key$with$dollar",
      ];

      specialKeys.forEach((key, index) => {
        server.embed(key, `value-${index}`);
        expect((server as any)[key]).toBe(`value-${index}`);
      });
    });

    it("should handle unicode keys", () => {
      const unicodeKeys = ["ключ", "🔑", "key_ключ", "тест_ключ"];

      unicodeKeys.forEach((key, index) => {
        server.embed(key, `unicode-value-${index}`);
        expect((server as any)[key]).toBe(`unicode-value-${index}`);
      });
    });

    it("should handle very long keys", () => {
      const longKey = "a".repeat(1000);
      server.embed(longKey, "long-key-value");

      expect((server as any)[longKey]).toBe("long-key-value");
    });
  });

  describe("embed with different value types", () => {
    it("should handle Date objects", () => {
      const date = new Date("2023-01-01T00:00:00Z");
      server.embed("dateValue", date);

      expect((server as any).dateValue).toBe(date);
    });

    it("should handle RegExp objects", () => {
      const regex = /test-pattern/gi;
      server.embed("regexValue", regex);

      expect((server as any).regexValue).toBe(regex);
    });

    it("should handle Map objects", () => {
      const map = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);
      server.embed("mapValue", map);

      expect((server as any).mapValue).toBe(map);
    });

    it("should handle Set objects", () => {
      const set = new Set([1, 2, 3, "test"]);
      server.embed("setValue", set);

      expect((server as any).setValue).toBe(set);
    });

    it("should handle Symbol values", () => {
      const symbol = Symbol("test-symbol");
      server.embed("symbolValue", symbol);

      expect((server as any).symbolValue).toBe(symbol);
    });

    it("should handle BigInt values", () => {
      const bigInt = BigInt(123456789);
      server.embed("bigIntValue", bigInt);

      expect((server as any).bigIntValue).toBe(bigInt);
    });
  });

  describe("embed with server context", () => {
    it("should embed server configuration", () => {
      const config = {
        database: { url: "postgresql://localhost:5432/test" },
        redis: { url: "redis://localhost:6379" },
        jwt: { secret: "super-secret" },
      };

      server.embed("config", config);

      expect((server as any).config).toEqual(config);
    });

    it("should embed middleware functions", () => {
      const authMiddleware = (req: any, res: any, next: any) => {
        req.user = { id: 1, name: "John" };
        next();
      };

      server.embed("authMiddleware", authMiddleware);

      expect((server as any).authMiddleware).toBe(authMiddleware);
    });

    it("should embed service instances", () => {
      const userService = {
        findById: (id: number) => ({ id, name: "User" }),
        create: (data: any) => ({ id: 1, ...data }),
      };

      server.embed("userService", userService);

      expect((server as any).userService).toBe(userService);
    });
  });
});
