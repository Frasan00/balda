import { NativeEnv } from "test/native_env";
import { Server } from "../../src/server/server";

const server = new Server({
  port: new NativeEnv().get("PORT")
    ? parseInt(new NativeEnv().get("PORT"))
    : 80,
  host: new NativeEnv().get("HOST") ? new NativeEnv().get("HOST") : "0.0.0.0",
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  logger: {
    level: "debug",
  },
  swagger: {
    type: "redoc",
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
  },
});

export const mockServer = server.getMockServer();

