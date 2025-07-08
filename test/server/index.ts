import { NativeEnv } from "test/native_env";
import { Server } from "../../src/server/server";
import { defineLoggerConfig, logger } from "src/logger/logger";

defineLoggerConfig({
  level: "debug",
});

const server = new Server({
  port: new NativeEnv().get("PORT")
    ? parseInt(new NativeEnv().get("PORT"))
    : 80,
  host: new NativeEnv().get("HOST") ? new NativeEnv().get("HOST") : "0.0.0.0",
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  swagger: {
    type: "standard",
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
  },
});

server.setErrorHandler((_req, res, next, error) => {
  logger.error(error);
  res.internalServerError({ error: "Internal server error" });
  next();
});

export const mockServer = await server.getMockServer();

server.listen(({ url }) => {
  logger.info(`Server is running on ${url}`);
});
