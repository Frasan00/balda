import { PolicyManager, logger, Server } from "../../src/index.js";
import { NativeEnv } from "../../src/runtime/native_env.js";

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

const serverBuilder = new Server({
  port: new NativeEnv().get("PORT")
    ? Number.parseInt(new NativeEnv().get("PORT") ?? "80")
    : 80,
  host: new NativeEnv().get("HOST") ? new NativeEnv().get("HOST") : "0.0.0.0",
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  swagger: {
    type: "standard",
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
    bodyParser: {
      json: {
        sizeLimit: "20mb",
      },
      urlencoded: {
        extended: true,
      },
      fileParser: {
        maxFiles: 10,
        maxFileSize: "10mb",
      },
    },
    static: {
      source: "public",
      path: "/public",
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
  cronUI: {
    path: "/cron",
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
