import { saveResults } from "./reporter.js";
import type { BenchmarkResult } from "./runner.js";
import { formatResult, runBenchmark, STANDARD_CONFIG } from "./runner.js";
import { BENCHMARK_SCENARIOS } from "./scenarios.js";

const runAllScenarios = async (): Promise<BenchmarkResult[]> => {
  const results: BenchmarkResult[] = [];
  const servers = [];

  console.log("🚀 Starting Comprehensive Benchmark Suite");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    `Configuration: -c ${STANDARD_CONFIG.connections} -d ${STANDARD_CONFIG.duration} -p ${STANDARD_CONFIG.pipelining}`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    for (const scenario of BENCHMARK_SCENARIOS) {
      console.log(`\n📦 Setting up scenario: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);

      const server = scenario.setup();
      servers.push(server);

      await new Promise<void>((resolve) => {
        server.listen(() => {
          console.log(`✓ Server started on port ${scenario.port}`);
          resolve();
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`\n📊 Running benchmark...`);

      let result: BenchmarkResult;

      if (scenario.name === "json-parsing") {
        result = await runBenchmark(
          `http://localhost:${scenario.port}/json`,
          scenario.name,
          STANDARD_CONFIG,
          "POST",
          { test: "data", value: 123 },
        );
      } else if (scenario.name === "route-params") {
        result = await runBenchmark(
          `http://localhost:${scenario.port}/users/123/posts/456`,
          scenario.name,
          STANDARD_CONFIG,
        );
      } else if (scenario.name === "query-parsing") {
        result = await runBenchmark(
          `http://localhost:${scenario.port}/search?q=test&filter=active&page=1&limit=10`,
          scenario.name,
          STANDARD_CONFIG,
        );
      } else {
        result = await runBenchmark(
          `http://localhost:${scenario.port}/`,
          scenario.name,
          STANDARD_CONFIG,
        );
      }

      results.push(result);
      console.log(formatResult(result));
    }
  } catch (err) {
    console.error("Benchmark failed:", err);
    throw err;
  } finally {
    console.log("\n🛑 Shutting down all servers...");
    for (const server of servers) {
      await server.close();
    }
    console.log("✓ All servers closed");
  }

  return results;
};

const printFinalSummary = (results: BenchmarkResult[]): void => {
  console.log("\n\n");
  console.log(
    "═══════════════════════════════════════════════════════════════════════════",
  );
  console.log(
    "                        BENCHMARK RESULTS SUMMARY                          ",
  );
  console.log(
    "═══════════════════════════════════════════════════════════════════════════\n",
  );

  const sortedByReqs = [...results].sort(
    (a, b) => b.requestsPerSec - a.requestsPerSec,
  );
  const sortedByLatency = [...results].sort(
    (a, b) => a.latencyAvg - b.latencyAvg,
  );

  console.log("🏆 Top 3 Scenarios by Throughput:\n");
  sortedByReqs.slice(0, 3).forEach((result, index) => {
    const medal = ["🥇", "🥈", "🥉"][index];
    console.log(
      `${medal}  ${result.scenario.padEnd(25)} ${result.requestsPerSec.toFixed(2).padStart(12)} req/sec`,
    );
  });

  console.log("\n⚡ Top 3 Scenarios by Latency:\n");
  sortedByLatency.slice(0, 3).forEach((result, index) => {
    const medal = ["🥇", "🥈", "🥉"][index];
    console.log(
      `${medal}  ${result.scenario.padEnd(25)} ${result.latencyAvg.toFixed(2).padStart(12)} ms`,
    );
  });

  const avgReqsPerSec =
    results.reduce((sum, r) => sum + r.requestsPerSec, 0) / results.length;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latencyAvg, 0) / results.length;
  const totalRequests = results.reduce((sum, r) => sum + r.requestsTotal, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log("\n📊 Overall Statistics:\n");
  console.log(`  Average Throughput:  ${avgReqsPerSec.toFixed(2)} req/sec`);
  console.log(`  Average Latency:     ${avgLatency.toFixed(2)} ms`);
  console.log(`  Total Requests:      ${totalRequests.toLocaleString()}`);
  console.log(`  Total Errors:        ${totalErrors}`);
  console.log(
    `  Error Rate:          ${((totalErrors / totalRequests) * 100).toFixed(4)}%`,
  );

  console.log(
    "\n═══════════════════════════════════════════════════════════════════════════\n",
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputDir = process.argv[2] || "./benchmark-results";

  runAllScenarios()
    .then((results) => {
      printFinalSummary(results);
      saveResults(results, outputDir);
      console.log("\n✨ Benchmark suite completed successfully!\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Benchmark failed:", err);
      process.exit(1);
    });
}
