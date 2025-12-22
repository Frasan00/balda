# Balda Framework Benchmark Suite

Comprehensive performance testing suite with standardized, machine-independent configurations.

## Standard Configuration

All benchmarks use consistent settings to ensure reproducible, machine-independent results:

```bash
-c 100  # Connections
-d 40   # Duration (seconds)
-p 10   # Pipelining
```

## Quick Start

### NPM Scripts

```bash
# Quick baseline benchmark (fastest)
npm run benchmark

# All scenarios (comprehensive)
npm run benchmark:all

# Plugin overhead analysis
npm run benchmark:plugins

# Runtime comparison
npm run benchmark:runtime

# Test with different runtimes
npm run benchmark:bun
npm run benchmark:deno
```

### Direct Shell Script

```bash
# Interactive menu
./run-benchmarks.sh

# Specific benchmarks
./run-benchmarks.sh --quick
./run-benchmarks.sh --all
./run-benchmarks.sh --runtime
./run-benchmarks.sh --plugins

# With different runtimes
USE_BUN=1 ./run-benchmarks.sh --all
USE_DENO=1 ./run-benchmarks.sh --all

# Help
./run-benchmarks.sh --help
```

## Benchmark Scenarios

### 1. Quick Baseline
Simple "Hello World" endpoint to establish baseline performance.

```bash
npm run benchmark:quick
```

### 2. All Scenarios
Tests multiple scenarios:
- **Baseline**: Minimal overhead
- **JSON Parsing**: POST with body parsing
- **Large Payload**: 1000-item response
- **Compression**: Gzip compression overhead
- **Route Params**: URL parameter parsing
- **Query Parsing**: Query string parsing
- **All Plugins**: Combined plugin overhead

```bash
npm run benchmark:scenarios
```

### 3. Plugin Overhead
Measures the performance impact of each plugin individually:
- No plugins (baseline)
- JSON only
- Compression only
- CORS only
- Helmet only
- Logger only
- All plugins combined

```bash
npm run benchmark:plugins
```

### 4. Runtime Comparison
Compares performance across Node.js, Bun, and Deno runtimes.

```bash
npm run benchmark:runtime
```

## Results

Benchmark results are saved to `benchmark-results/TIMESTAMP/`:

```
benchmark-results/
└── 20241220-143055/
    ├── results.json          # Raw JSON data
    ├── REPORT.md             # Markdown report
    ├── quick-baseline.log    # Individual benchmark logs
    ├── all-scenarios.log
    ├── plugin-overhead.log
    └── runtime-comparison.log
```

## Understanding Results

### Requests Per Second (req/sec)
Higher is better. Indicates throughput capacity.

### Latency (ms)
- **Average**: Mean response time
- **P50**: 50th percentile (median)
- **P95**: 95th percentile
- **P99**: 99th percentile (worst 1% of requests)

Lower is better. P99 is crucial for tail latency.

### Throughput (MB/s)
Data transfer rate. Higher is better.

### Error Rate
Should be 0% or close to 0%. High error rates indicate issues.

## Machine Independence

The standardized configuration (`-c 100 -d 40 -p 10`) ensures:

1. **Consistent Load**: 100 concurrent connections generate comparable stress across machines
2. **Sufficient Duration**: 40 seconds allows warm-up and steady-state measurement
3. **Reasonable Pipelining**: 10 requests per connection balances throughput without overwhelming

Results can be compared across:
- Different machines
- Different runtimes (Node.js, Bun, Deno)
- Different versions of Balda
- Different deployment configurations
