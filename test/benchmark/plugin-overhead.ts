import { json } from "../../src/plugins/body_parser/json/json.js";
import { compression } from "../../src/plugins/compression/compression.js";
import { cors } from "../../src/plugins/cors/cors.js";
import { helmet } from "../../src/plugins/helmet/helmet.js";
import { log as logPlugin } from "../../src/plugins/log/log.js";
import { Server } from "../../src/server/server.js";
import type { BenchmarkResult } from "./runner.js";
import { formatResult, runBenchmark, STANDARD_CONFIG } from "./runner.js";

interface PluginConfig {
  name: string;
  port: number;
  plugins: (() => any)[];
}

const PLUGIN_CONFIGS: PluginConfig[] = [
  {
    name: "no-plugins",
    port: 4000,
    plugins: [],
  },
  {
    name: "json-only",
    port: 4001,
    plugins: [json],
  },
  {
    name: "compression-only",
    port: 4002,
    plugins: [compression],
  },
  {
    name: "cors-only",
    port: 4003,
    plugins: [cors],
  },
  {
    name: "helmet-only",
    port: 4004,
    plugins: [helmet],
  },
  {
    name: "logger-only",
    port: 4005,
    plugins: [logPlugin],
  },
  {
    name: "all-plugins",
    port: 4006,
    plugins: [json, compression, cors, helmet, logPlugin],
  },
];

const createServerWithPlugins = (config: PluginConfig): Server => {
  const server = new Server({
    port: config.port,
    swagger: false,
    host: "0.0.0.0",
  });

  config.plugins.forEach((plugin) => {
    server.use(plugin());
  });

  server.get("/", (_req, res) => {
    res.json({ message: "Hello, world!" });
  });

  server.post("/data", (req, res) => {
    res.json({ received: req.body || {} });
  });

  return server;
};

export const runPluginOverheadBenchmark = async (): Promise<
  BenchmarkResult[]
> => {
  const results: BenchmarkResult[] = [];
  const servers: Server[] = [];

  console.log("🔧 Starting Plugin Overhead Benchmark");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    for (const config of PLUGIN_CONFIGS) {
      const server = createServerWithPlugins(config);
      servers.push(server);

      await new Promise<void>((resolve) => {
        server.listen(() => {
          console.log(`✓ Started ${config.name} server on port ${config.port}`);
          resolve();
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`\n📊 Benchmarking ${config.name}...`);
      const result = await runBenchmark(
        `http://localhost:${config.port}/`,
        `plugin-${config.name}`,
        STANDARD_CONFIG,
      );
      results.push(result);
      console.log(formatResult(result));
    }
  } catch (err) {
    console.error("Benchmark failed:", err);
    throw err;
  } finally {
    console.log("\n🛑 Shutting down servers...");
    for (const server of servers) {
      await server.close();
    }
    console.log("✓ All servers closed");
  }

  return results;
};

const calculateOverhead = (
  baseline: BenchmarkResult,
  withPlugin: BenchmarkResult,
) => {
  const reqsPerSecDiff =
    ((withPlugin.requestsPerSec - baseline.requestsPerSec) /
      baseline.requestsPerSec) *
    100;
  const latencyDiff =
    ((withPlugin.latencyAvg - baseline.latencyAvg) / baseline.latencyAvg) * 100;

  return {
    name: withPlugin.scenario.replace("plugin-", ""),
    reqsPerSecChange: reqsPerSecDiff.toFixed(2),
    latencyChange: latencyDiff.toFixed(2),
    requestsPerSec: withPlugin.requestsPerSec.toFixed(2),
    latencyAvg: withPlugin.latencyAvg.toFixed(2),
  };
};

export const printOverheadSummary = (results: BenchmarkResult[]): void => {
  const baseline = results.find((r) => r.scenario === "plugin-no-plugins");
  if (!baseline) {
    console.error("Baseline results not found!");
    return;
  }

  console.log("\n\n📈 Plugin Overhead Summary");
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
  );
  console.log("Baseline (no plugins):");
  console.log(`  Requests/sec: ${baseline.requestsPerSec.toFixed(2)}`);
  console.log(`  Latency Avg:  ${baseline.latencyAvg.toFixed(2)} ms\n`);
  console.log("Plugin Impact:\n");
  console.log(
    "┌─────────────────────┬─────────────────┬───────────────┬──────────────┬────────────────┐",
  );
  console.log(
    "│ Plugin              │ Req/sec         │ Change (%)    │ Latency (ms) │ Change (%)     │",
  );
  console.log(
    "├─────────────────────┼─────────────────┼───────────────┼──────────────┼────────────────┤",
  );

  results.forEach((result) => {
    if (result.scenario === "plugin-no-plugins") {
      return;
    }
    const overhead = calculateOverhead(baseline, result);
    const reqColor =
      Number.parseFloat(overhead.reqsPerSecChange) < -5 ? "⚠️ " : "✓ ";
    const latColor =
      Number.parseFloat(overhead.latencyChange) > 10 ? "⚠️ " : "✓ ";

    console.log(
      `│ ${overhead.name.padEnd(19)} │ ${overhead.requestsPerSec.padEnd(15)} │ ${reqColor}${overhead.reqsPerSecChange.padEnd(11)} │ ${overhead.latencyAvg.padEnd(12)} │ ${latColor}${overhead.latencyChange.padEnd(12)} │`,
    );
  });
  console.log(
    "└─────────────────────┴─────────────────┴───────────────┴──────────────┴────────────────┘\n",
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runPluginOverheadBenchmark()
    .then((results) => {
      printOverheadSummary(results);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Benchmark failed:", err);
      process.exit(1);
    });
}
