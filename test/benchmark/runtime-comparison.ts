import { Server } from "../../src/server/server.js";
import type { BenchmarkResult } from "./runner.js";
import { formatResult, runBenchmark, STANDARD_CONFIG } from "./runner.js";

const PORT = 5000;

const createTestServer = (): Server => {
  const server = new Server({
    port: PORT,
    swagger: false,
    host: "0.0.0.0",
  });

  server.router.get("/", (_req, res) => {
    res.json({ message: "Hello, world!" });
  });

  server.router.get("/json", (_req, res) => {
    res.json({
      id: 123,
      name: "Test User",
      email: "test@example.com",
      profile: {
        age: 25,
        city: "New York",
        interests: ["coding", "reading", "gaming"],
      },
    });
  });

  server.router.get("/large", (_req, res) => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random(),
    }));
    res.json({ data });
  });

  return server;
};

export const runRuntimeComparison = async (): Promise<BenchmarkResult[]> => {
  const results: BenchmarkResult[] = [];

  console.log("🚀 Starting Runtime Comparison Benchmark");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const server = createTestServer();

  try {
    await new Promise<void>((resolve) => {
      server.listen(() => {
        console.log(`✓ Server started on port ${PORT}`);
        resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const scenarios = [
      { url: `http://localhost:${PORT}/`, name: "simple-get" },
      { url: `http://localhost:${PORT}/json`, name: "json-response" },
      { url: `http://localhost:${PORT}/large`, name: "large-response" },
    ];

    for (const scenario of scenarios) {
      console.log(`\n📊 Benchmarking ${scenario.name}...`);
      const result = await runBenchmark(
        scenario.url,
        scenario.name,
        STANDARD_CONFIG,
      );
      results.push(result);
      console.log(formatResult(result));
    }
  } catch (err) {
    console.error("Benchmark failed:", err);
    throw err;
  } finally {
    console.log("\n🛑 Shutting down server...");
    await server.close();
    console.log("✓ Server closed");
  }

  return results;
};

export const printRuntimeSummary = (results: BenchmarkResult[]): void => {
  if (results.length === 0) {
    return;
  }

  const runtime = results[0].runtime;

  console.log("\n\n📊 Runtime Performance Summary");
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
  );
  console.log(`Runtime: ${runtime.toUpperCase()}`);
  console.log(`Node Version: ${process.version || "N/A"}\n`);
  console.log(
    "┌─────────────────────┬─────────────────┬──────────────┬──────────────┬──────────────┐",
  );
  console.log(
    "│ Scenario            │ Req/sec         │ Latency (ms) │ P99 (ms)     │ Throughput   │",
  );
  console.log(
    "├─────────────────────┼─────────────────┼──────────────┼──────────────┼──────────────┤",
  );

  results.forEach((result) => {
    console.log(
      `│ ${result.scenario.padEnd(19)} │ ${result.requestsPerSec.toFixed(2).padEnd(15)} │ ${result.latencyAvg.toFixed(2).padEnd(12)} │ ${result.latencyP99.toFixed(2).padEnd(12)} │ ${result.throughputMB.toFixed(2).padEnd(12)} │`,
    );
  });
  console.log(
    "└─────────────────────┴─────────────────┴──────────────┴──────────────┴──────────────┘\n",
  );

  const avgReqsPerSec =
    results.reduce((sum, r) => sum + r.requestsPerSec, 0) / results.length;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latencyAvg, 0) / results.length;

  console.log("Average Performance:");
  console.log(`  Requests/sec: ${avgReqsPerSec.toFixed(2)}`);
  console.log(`  Latency:      ${avgLatency.toFixed(2)} ms\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runRuntimeComparison()
    .then((results) => {
      printRuntimeSummary(results);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Benchmark failed:", err);
      process.exit(1);
    });
}
