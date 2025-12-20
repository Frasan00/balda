import type { Result } from "autocannon";
import Autocannon from "autocannon";

export interface BenchmarkConfig {
  connections: number;
  duration: number;
  pipelining: number;
}

export const STANDARD_CONFIG: BenchmarkConfig = {
  connections: 100,
  duration: 40,
  pipelining: 10,
};

export interface BenchmarkResult {
  scenario: string;
  runtime: string;
  requestsPerSec: number;
  requestsTotal: number;
  latencyAvg: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  throughputMB: number;
  errors: number;
  timeouts: number;
  memoryUsageMB: number;
}

const getRuntimeName = (): string => {
  if (typeof Bun !== "undefined") {
    return "bun";
  }
  if (typeof Deno !== "undefined") {
    return "deno";
  }
  return "node";
};

export const runBenchmark = async (
  url: string,
  scenarioName: string,
  config: BenchmarkConfig = STANDARD_CONFIG,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<BenchmarkResult> => {
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

  const autocannonConfig: Autocannon.Options = {
    url,
    duration: config.duration,
    connections: config.connections,
    pipelining: config.pipelining,
    method,
  };

  if (body && method === "POST") {
    autocannonConfig.body = JSON.stringify(body);
    autocannonConfig.headers = {
      "Content-Type": "application/json",
    };
  }

  const result: Result = await Autocannon(autocannonConfig);

  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

  return {
    scenario: scenarioName,
    runtime: getRuntimeName(),
    requestsPerSec: result.requests?.average || 0,
    requestsTotal: result.requests?.total || 0,
    latencyAvg: result.latency?.mean || 0,
    latencyP50: result.latency?.p50 || 0,
    latencyP95: result.latency?.p97_5 || 0,
    latencyP99: result.latency?.p99 || 0,
    throughputMB: (result.throughput?.average || 0) / (1024 * 1024),
    errors: result.errors || 0,
    timeouts: result.timeouts || 0,
    memoryUsageMB: Math.max(0, memAfter - memBefore),
  };
};

export const formatResult = (result: BenchmarkResult): string => {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scenario: ${result.scenario}
Runtime:  ${result.runtime}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Throughput:
  Requests/sec:  ${(result.requestsPerSec || 0).toFixed(2)}
  Total:         ${result.requestsTotal || 0}
  Throughput:    ${(result.throughputMB || 0).toFixed(2)} MB/s

Latency:
  Average:       ${(result.latencyAvg || 0).toFixed(2)} ms
  P50:           ${(result.latencyP50 || 0).toFixed(2)} ms
  P95:           ${(result.latencyP95 || 0).toFixed(2)} ms
  P99:           ${(result.latencyP99 || 0).toFixed(2)} ms

Errors:
  Total:         ${result.errors || 0}
  Timeouts:      ${result.timeouts || 0}

Memory:
  Delta:         ${(result.memoryUsageMB || 0).toFixed(2)} MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
};
