import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Server } from "../../src/index.js";

describe("Server Environment Functions", () => {
  let server: Server<"http">;
  const originalEnv = process.env;

  beforeEach(() => {
    server = new Server();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getEnvironment method", () => {
    it("should return all environment variables", () => {
      const env = server.getEnvironment();

      expect(env).toBeDefined();
      expect(typeof env).toBe("object");
      expect(Array.isArray(env)).toBe(false);
    });

    it("should include NODE_ENV if set", () => {
      process.env.NODE_ENV = "test";

      const env = server.getEnvironment();

      expect(env.NODE_ENV).toBe("test");
    });

    it("should include custom environment variables", () => {
      process.env.CUSTOM_VAR = "custom-value";
      process.env.API_KEY = "secret-key";

      const env = server.getEnvironment();

      expect(env.CUSTOM_VAR).toBe("custom-value");
      expect(env.API_KEY).toBe("secret-key");
    });

    it("should handle empty environment variables", () => {
      const env = server.getEnvironment();

      // Should not include undefined values
      Object.values(env).forEach((value) => {
        expect(value).toBeDefined();
        expect(value).not.toBeUndefined();
      });
    });

    it("should return a copy of environment variables", () => {
      const env1 = server.getEnvironment();
      const env2 = server.getEnvironment();

      expect(env1).toEqual(env2);
      expect(env1).not.toBe(env2); // Different object references
    });

    it("should handle special characters in environment values", () => {
      process.env.SPECIAL_CHARS = "value with spaces and symbols !@#$%^&*()";
      process.env.UNICODE_VAR = "пароль123🔐";

      const env = server.getEnvironment();

      expect(env.SPECIAL_CHARS).toBe(
        "value with spaces and symbols !@#$%^&*()",
      );
      expect(env.UNICODE_VAR).toBe("пароль123🔐");
    });

    it("should handle numeric environment variables as strings", () => {
      process.env.PORT = "3000";
      process.env.TIMEOUT = "5000";

      const env = server.getEnvironment();

      expect(env.PORT).toBe("3000");
      expect(env.TIMEOUT).toBe("5000");
      expect(typeof env.PORT).toBe("string");
      expect(typeof env.TIMEOUT).toBe("string");
    });

    it("should handle boolean-like environment variables", () => {
      process.env.DEBUG = "true";
      process.env.PRODUCTION = "false";

      const env = server.getEnvironment();

      expect(env.DEBUG).toBe("true");
      expect(env.PRODUCTION).toBe("false");
    });

    it("should handle JSON-like environment variables", () => {
      process.env.CONFIG = '{"key": "value", "nested": {"prop": "val"}}';

      const env = server.getEnvironment();

      expect(env.CONFIG).toBe('{"key": "value", "nested": {"prop": "val"}}');
    });

    it("should handle multiline environment variables", () => {
      process.env.MULTILINE = "line1\nline2\nline3";

      const env = server.getEnvironment();

      expect(env.MULTILINE).toBe("line1\nline2\nline3");
    });
  });

  describe("environment variable access patterns", () => {
    it("should work with common environment variable patterns", () => {
      const commonVars = {
        NODE_ENV: "test",
        PORT: "3000",
        HOST: "localhost",
        DATABASE_URL: "postgresql://localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "super-secret-key",
        API_VERSION: "v1",
        LOG_LEVEL: "info",
      };

      Object.entries(commonVars).forEach(([key, value]) => {
        process.env[key] = value;
      });

      const env = server.getEnvironment();

      Object.entries(commonVars).forEach(([key, value]) => {
        expect(env[key]).toBe(value);
      });
    });

    it("should handle environment variables with different naming conventions", () => {
      const namingConventions = {
        camelCase: "value1",
        snake_case: "value2",
        "kebab-case": "value3",
        UPPER_CASE: "value4",
        mixed_CASE: "value5",
        "with-numbers123": "value6",
      };

      Object.entries(namingConventions).forEach(([key, value]) => {
        process.env[key] = value;
      });

      const env = server.getEnvironment();

      Object.entries(namingConventions).forEach(([key, value]) => {
        expect(env[key]).toBe(value);
      });
    });
  });

  describe("server properties", () => {
    it("should have correct server properties", () => {
      expect(server.port).toBeDefined();
      expect(server.host).toBeDefined();
      expect(server.url).toBeDefined();
      expect(server.isListening).toBe(false);
    });

    it("should have router property", () => {
      expect(server.router).toBeDefined();
      expect(typeof server.router).toBe("object");
    });
  });

  describe("environment variable filtering", () => {
    it("should only include defined environment variables", () => {
      // Set some variables
      process.env.DEFINED_VAR = "defined";
      process.env.EMPTY_VAR = "";

      // Don't set undefined variables
      delete process.env.UNDEFINED_VAR;

      const env = server.getEnvironment();

      expect(env.DEFINED_VAR).toBe("defined");
      expect(env.EMPTY_VAR).toBe("");
      expect(env.UNDEFINED_VAR).toBeUndefined();
    });
  });
});
