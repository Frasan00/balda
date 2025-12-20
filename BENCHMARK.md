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

### Sample Report

The generated `REPORT.md` includes:
- Summary statistics
- Detailed per-scenario results
- Performance analysis
- Top performers by throughput and latency
- Configuration details

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

## Continuous Benchmarking

### In CI/CD

Add to your CI pipeline to detect performance regressions:

```yaml
# .github/workflows/benchmark.yml
- name: Run benchmarks
  run: npm run benchmark:all

- name: Store results
  uses: actions/upload-artifact@v3
  with:
    name: benchmark-results
    path: benchmark-results/
```

### Local Development

Run before and after major changes:

```bash
# Before changes
npm run benchmark:all
cp -r benchmark-results/latest before-changes/

# Make changes...

# After changes
npm run benchmark:all
cp -r benchmark-results/latest after-changes/

# Compare results
diff before-changes/REPORT.md after-changes/REPORT.md
```

## Advanced Usage

### Custom Configuration

Modify `STANDARD_CONFIG` in `test/benchmark/runner.ts`:

```typescript
export const STANDARD_CONFIG: BenchmarkConfig = {
  connections: 100,
  duration: 40,
  pipelining: 10,
};
```

### Adding Custom Scenarios

Edit `test/benchmark/scenarios.ts`:

```typescript
{
  name: "my-scenario",
  port: 3010,
  description: "My custom test scenario",
  setup: () => {
    const server = new Server({ port: 3010, swagger: false });
    // Your setup code
    return server;
  },
}
```

### Integration with Other Tools

The suite can be extended with:
- **Clinic.js**: CPU and memory profiling
- **Artillery**: Complex load patterns
- **K6**: Advanced scenarios and scripting
- **0x**: Flame graphs

## Troubleshooting

### Port Already in Use

If benchmarks fail with "port in use" errors:

```bash
# Check for processes on benchmark ports (3000-3010, 4000-4010, 5000)
lsof -ti:3000-5000 | xargs kill -9
```

### Memory Issues

For memory-constrained environments, reduce connections:

```typescript
// In runner.ts
export const STANDARD_CONFIG: BenchmarkConfig = {
  connections: 50,  // Reduced from 100
  duration: 40,
  pipelining: 10,
};
```

### Inconsistent Results

Ensure:
1. No other services consuming resources
2. System is not thermal throttling
3. Network/disk is not saturated
4. Run multiple times and average results

## Best Practices

1. **Warm up**: First run may be slower due to JIT compilation
2. **Multiple runs**: Run 3-5 times and average results
3. **Controlled environment**: Close unnecessary applications
4. **Document conditions**: Note CPU, RAM, OS in reports
5. **Version control**: Track benchmark results over time
6. **Regression testing**: Alert on >10% performance drops

## Contributing

When contributing performance improvements:

1. Run baseline before changes
2. Make your changes
3. Run benchmarks again
4. Include before/after comparison in PR
5. Explain performance impact

## License

MIT License - see main project LICENSE file.

