import { json } from "../../src/plugins/body_parser/json/json.js";
import { compression } from "../../src/plugins/compression/compression.js";
import { cors } from "../../src/plugins/cors/cors.js";
import { helmet } from "../../src/plugins/helmet/helmet.js";
import { log as logPlugin } from "../../src/plugins/log/log.js";
import { Server } from "../../src/server/server.js";

export interface ScenarioConfig {
  name: string;
  port: number;
  description: string;
  setup: () => Server;
}

export const BENCHMARK_SCENARIOS: ScenarioConfig[] = [
  {
    name: "baseline",
    port: 3000,
    description: "Minimal overhead - baseline performance",
    setup: () => {
      const server = new Server({
        port: 3000,
        swagger: false,
        host: "0.0.0.0",
      });
      server.router.get("/", (_req, res) => {
        res.json({ message: "Hello, world!" });
      });
      return server;
    },
  },
  {
    name: "json-parsing",
    port: 3001,
    description: "JSON body parsing overhead",
    setup: () => {
      const server = new Server({
        port: 3001,
        swagger: false,
        host: "0.0.0.0",
      });
      server.use(json());
      server.router.post("/json", (req, res) => {
        res.json({ received: req.body });
      });
      return server;
    },
  },
  {
    name: "large-payload",
    port: 3002,
    description: "Large JSON response serialization",
    setup: () => {
      const server = new Server({
        port: 3002,
        swagger: false,
        host: "0.0.0.0",
      });
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        email: `user${i}@example.com`,
        metadata: {
          created: new Date().toISOString(),
          score: Math.random() * 100,
          tags: [`tag${i % 10}`, `category${i % 5}`],
        },
      }));
      server.router.get("/large", (_req, res) => {
        res.json({ data: largeData });
      });
      return server;
    },
  },
  {
    name: "with-compression",
    port: 3003,
    description: "Compression plugin overhead",
    setup: () => {
      const server = new Server({
        port: 3003,
        swagger: false,
        host: "0.0.0.0",
      });
      server.use(compression());
      const data = { message: "x".repeat(10000) };
      server.router.get("/compressed", (_req, res) => {
        res.json(data);
      });
      return server;
    },
  },
  {
    name: "route-params",
    port: 3004,
    description: "Route parameter parsing",
    setup: () => {
      const server = new Server({
        port: 3004,
        swagger: false,
        host: "0.0.0.0",
      });
      server.router.get("/users/:id/posts/:postId", (req, res) => {
        res.json({
          userId: req.params.id,
          postId: req.params.postId,
        });
      });
      return server;
    },
  },
  {
    name: "query-parsing",
    port: 3005,
    description: "Query string parsing",
    setup: () => {
      const server = new Server({
        port: 3005,
        swagger: false,
        host: "0.0.0.0",
      });
      server.router.get("/search", (req, res) => {
        res.json({
          query: req.query,
          count: Object.keys(req.query).length,
        });
      });
      return server;
    },
  },
  {
    name: "all-plugins",
    port: 3006,
    description: "All common plugins enabled",
    setup: () => {
      const server = new Server({
        port: 3006,
        swagger: false,
        host: "0.0.0.0",
      });
      server.use(json());
      server.use(cors());
      server.use(helmet());
      server.use(logPlugin());
      server.use(compression());

      server.router.get("/", (_req, res) => {
        res.json({ message: "Hello with all plugins!" });
      });

      server.router.post("/data", (req, res) => {
        res.json({ received: req.body });
      });

      return server;
    },
  },
];
