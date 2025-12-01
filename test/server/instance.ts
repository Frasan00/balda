import { defineLoggerConfig, logger } from "src/logger/logger";
import { NativeEnv } from "src/runtime/native_env";
import { PolicyManager } from "src/server/policy/policy_manager";
import { Server } from "../../src/server/server";

export const policyManager = new PolicyManager({
  test: {
    adminRoute: async (user: { id: string; name: string; role: string }) => {
      if (user.role === "admin") {
        return true;
      }

      return false;
    },
  },
});

defineLoggerConfig({
  level: "debug",
});

const serverBuilder = new Server({
  port: new NativeEnv().get("PORT")
    ? parseInt(new NativeEnv().get("PORT"))
    : 80,
  host: new NativeEnv().get("HOST") ? new NativeEnv().get("HOST") : "0.0.0.0",
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  swagger: {
    type: "redoc",
    models: {
      User: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
    },
  },
  plugins: {
    static: "public",
    json: {
      sizeLimit: 1024 * 1024 * 20,
    },
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    helmet: {
      contentSecurityPolicy: false,
    },
    cookie: {
      secret: "secret",
    },
    urlencoded: {
      extended: true,
    },
    log: {
      logResponse: true,
    },
    session: {
      secret: "secret",
      ttl: 60 * 60 * 24,
    },
    timeout: {
      ms: 10000,
    },
    trustProxy: {
      trust: true,
      header: "x-forwarded-for",
      hop: "first",
    },
  },
});

serverBuilder.setErrorHandler((_req, res, next, error) => {
  logger.error(error);
  res.internalServerError({ error: "Internal server error" });
  return next();
});

serverBuilder.get("/", (_req, res) => {
  res.redirect("/docs");
});

export const mockServer = await serverBuilder.getMockServer();
export const server = serverBuilder;
