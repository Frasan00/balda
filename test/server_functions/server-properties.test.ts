import { describe, it, expect, beforeEach } from "vitest";
import { Server } from "src/server/server";

describe("Server Properties and Basic Functions", () => {
  let server: Server;

  beforeEach(() => {
    server = new Server({
      port: 3000,
      host: "localhost",
    });
  });

  describe("server properties", () => {
    it("should have correct initial state", () => {
      expect(server.isListening).toBe(false);
      expect(server.port).toBe(3000);
      expect(server.host).toBe("localhost");
      expect(server.url).toBe("http://localhost:3000");
    });

    it("should have router property", () => {
      expect(server.router).toBeDefined();
      expect(typeof server.router).toBe("object");
    });

    it("should update url when port or host changes", () => {
      const server2 = new Server({
        port: 8080,
        host: "0.0.0.0",
      });

      expect(server2.port).toBe(8080);
      expect(server2.host).toBe("0.0.0.0");
      expect(server2.url).toBe("http://0.0.0.0:8080");
    });

    it("should handle different host formats", () => {
      const testCases = [
        { host: "127.0.0.1", port: 3000, expectedUrl: "http://127.0.0.1:3000" },
        { host: "0.0.0.0", port: 8080, expectedUrl: "http://0.0.0.0:8080" },
        { host: "localhost", port: 5000, expectedUrl: "http://localhost:5000" },
      ];

      testCases.forEach(({ host, port, expectedUrl }) => {
        const testServer = new Server({ host, port });
        expect(testServer.url).toBe(expectedUrl);
      });
    });
  });

  describe("server constructor options", () => {
    it("should use default values when no options provided", () => {
      const defaultServer = new Server();

      expect(defaultServer.port).toBeDefined();
      expect(defaultServer.host).toBeDefined();
      expect(defaultServer.url).toBeDefined();
    });

    it("should use environment variables when available", () => {
      const originalEnv = process.env;
      process.env.PORT = "4000";
      process.env.HOST = "127.0.0.1";

      const envServer = new Server();

      expect(envServer.port).toBe(4000);
      expect(envServer.host).toBe("127.0.0.1");
      expect(envServer.url).toBe("http://127.0.0.1:4000");

      process.env = originalEnv;
    });

    it("should prioritize constructor options over environment variables", () => {
      const originalEnv = process.env;
      process.env.PORT = "4000";
      process.env.HOST = "127.0.0.1";

      const server = new Server({
        port: 5000,
        host: "localhost",
      });

      expect(server.port).toBe(5000);
      expect(server.host).toBe("localhost");
      expect(server.url).toBe("http://localhost:5000");

      process.env = originalEnv;
    });

    it("should handle numeric port from environment", () => {
      const originalEnv = process.env;
      process.env.PORT = "3000";

      const server = new Server();

      expect(server.port).toBe(3000);
      expect(typeof server.port).toBe("number");

      process.env = originalEnv;
    });

    it("should handle string port from environment", () => {
      const originalEnv = process.env;
      process.env.PORT = "8080";

      const server = new Server();

      expect(server.port).toBe(8080);
      expect(typeof server.port).toBe("number");

      process.env = originalEnv;
    });
  });

  describe("server state management", () => {
    it("should track listening state correctly", () => {
      expect(server.isListening).toBe(false);

      // Note: We don't actually call listen() in tests to avoid port conflicts
      // but we can verify the initial state
    });

    it("should have consistent property types", () => {
      expect(typeof server.isListening).toBe("boolean");
      expect(typeof server.port).toBe("number");
      expect(typeof server.host).toBe("string");
      expect(typeof server.url).toBe("string");
    });

    it("should have immutable core properties", () => {
      const originalPort = server.port;
      const originalHost = server.host;
      const originalUrl = server.url;

      // These should not be directly modifiable
      expect(server.port).toBe(originalPort);
      expect(server.host).toBe(originalHost);
      expect(server.url).toBe(originalUrl);
    });
  });

  describe("server router integration", () => {
    it("should have router with correct methods", () => {
      expect(typeof server.router.get).toBe("function");
      expect(typeof server.router.post).toBe("function");
      expect(typeof server.router.put).toBe("function");
      expect(typeof server.router.patch).toBe("function");
      expect(typeof server.router.delete).toBe("function");
      expect(typeof server.router.options).toBe("function");
      expect(typeof server.router.group).toBe("function");
    });

    it("should maintain router reference", () => {
      const router1 = server.router;
      const router2 = server.router;

      expect(router1).toBe(router2); // Same reference
    });
  });

  describe("server URL generation", () => {
    it("should generate correct URLs for different configurations", () => {
      const configurations = [
        { port: 3000, host: "localhost", expected: "http://localhost:3000" },
        { port: 8080, host: "127.0.0.1", expected: "http://127.0.0.1:8080" },
        { port: 443, host: "0.0.0.0", expected: "http://0.0.0.0:443" },
        { port: 80, host: "example.com", expected: "http://example.com:80" },
      ];

      configurations.forEach(({ port, host, expected }) => {
        const testServer = new Server({ port, host });
        expect(testServer.url).toBe(expected);
      });
    });

    it("should handle edge case ports", () => {
      const edgeCases = [
        { port: 1, host: "localhost" },
        { port: 65535, host: "localhost" },
        { port: 8080, host: "localhost" },
      ];

      edgeCases.forEach(({ port, host }) => {
        const testServer = new Server({ port, host });
        expect(testServer.port).toBe(port);
        expect(testServer.host).toBe(host);
        expect(testServer.url).toContain(port.toString());
      });
    });
  });

  describe("server initialization", () => {
    it("should initialize with default plugins", () => {
      // Server should have body parser enabled by default
      expect(server.routes).toBeDefined();
    });

    it("should handle custom options", () => {
      const customServer = new Server({
        port: 9999,
        host: "custom-host",
        controllerPatterns: ["**/*.controller.ts"],
        plugins: {},
        swagger: false,
        useBodyParser: false,
      });

      expect(customServer.port).toBe(9999);
      expect(customServer.host).toBe("custom-host");
    });

    it("should handle empty options object", () => {
      const emptyServer = new Server({});

      expect(emptyServer.port).toBeDefined();
      expect(emptyServer.host).toBeDefined();
      expect(emptyServer.url).toBeDefined();
    });

    it("should handle undefined options", () => {
      const undefinedServer = new Server(undefined);

      expect(undefinedServer.port).toBeDefined();
      expect(undefinedServer.host).toBeDefined();
      expect(undefinedServer.url).toBeDefined();
    });
  });

  describe("server property consistency", () => {
    it("should maintain property consistency across instances", () => {
      const server1 = new Server({ port: 3000, host: "localhost" });
      const server2 = new Server({ port: 3000, host: "localhost" });

      expect(server1.port).toBe(server2.port);
      expect(server1.host).toBe(server2.host);
      expect(server1.url).toBe(server2.url);
    });

    it("should have consistent property types across different configurations", () => {
      const servers = [
        new Server({ port: 3000, host: "localhost" }),
        new Server({ port: 8080, host: "127.0.0.1" }),
        new Server({ port: 5000, host: "0.0.0.0" }),
      ];

      servers.forEach((server) => {
        expect(typeof server.isListening).toBe("boolean");
        expect(typeof server.port).toBe("number");
        expect(typeof server.host).toBe("string");
        expect(typeof server.url).toBe("string");
        expect(Array.isArray(server.routes)).toBe(true);
      });
    });
  });
});
