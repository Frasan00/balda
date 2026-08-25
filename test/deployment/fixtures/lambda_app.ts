/**
 * Bundled by test/deployment/lambda-floci.test.ts into a real Lambda deployment zip and run
 * against Floci's Docker-backed Lambda executor - proving `handle()` actually works inside a
 * real `nodejs22.x` Lambda container, not just against fixture events in-process.
 */
import { Server, handle } from "../../../src/index.js";

const server = new Server({
  swagger: false,
  plugins: { bodyParser: { json: {} } },
});

server.router.get("/hello/:name", (req, res) => {
  res.ok({ message: `Hello, ${req.params.name}!` });
});

server.router.post("/echo", { middlewares: [] }, (req, res) => {
  res.ok(req.body as any);
});

// esbuild (format: "cjs") turns this into `exports.handler = ...` in the bundled output.
export const handler = handle(server);
