#!/bin/bash

# Balda Framework Benchmark Suite
# Comprehensive performance testing with standardized configurations
# Configuration: -c 100 -d 40 -p 10 (machine-independent)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Banner
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                  BALDA FRAMEWORK BENCHMARK SUITE                          "
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "Standard Configuration: -c 100 -d 40 -p 10"
echo "  Connections:  100"
echo "  Duration:     40 seconds"
echo "  Pipelining:   10"
echo ""
echo "This standardized configuration ensures machine-independent results."
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Create results directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="benchmark-results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}Results will be saved to: $RESULTS_DIR${NC}\n"

# Runtime detection
RUNTIME="node"
if command -v bun &> /dev/null && [[ "$USE_BUN" == "1" ]]; then
    RUNTIME="bun"
elif command -v deno &> /dev/null && [[ "$USE_DENO" == "1" ]]; then
    RUNTIME="deno"
fi

echo -e "${GREEN}Using runtime: $RUNTIME${NC}\n"

# Function to run benchmark and capture output
run_benchmark() {
    local name=$1
    local script=$2
    local log_file="$RESULTS_DIR/$name.log"

    echo -e "${YELLOW}[Running: $name]${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$RUNTIME" == "node" ]; then
        npx tsx "$script" "$RESULTS_DIR" 2>&1 | tee "$log_file"
    elif [ "$RUNTIME" == "bun" ]; then
        bun run "$script" "$RESULTS_DIR" 2>&1 | tee "$log_file"
    elif [ "$RUNTIME" == "deno" ]; then
        deno run --allow-all --sloppy-imports --import-map import_map.json "$script" "$RESULTS_DIR" 2>&1 | tee "$log_file"
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $name completed successfully${NC}\n"
    else
        echo -e "${RED}✗ $name failed with exit code $exit_code${NC}\n"
    fi

    return $exit_code
}

# Menu for benchmark selection
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --quick          Run quick baseline benchmark only"
    echo "  --all            Run all benchmark scenarios"
    echo "  --runtime        Run runtime comparison"
    echo "  --plugins        Run plugin overhead analysis"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  USE_BUN=1        Use Bun runtime"
    echo "  USE_DENO=1       Use Deno runtime"
    echo ""
    echo "Examples:"
    echo "  $0 --quick                # Quick baseline test"
    echo "  $0 --all                  # All scenarios"
    echo "  USE_BUN=1 $0 --all        # All scenarios with Bun"
    echo ""
    exit 0
fi

# Determine which benchmarks to run
RUN_QUICK=0
RUN_ALL=0
RUN_RUNTIME=0
RUN_PLUGINS=0

if [ "$1" == "--quick" ]; then
    RUN_QUICK=1
elif [ "$1" == "--all" ]; then
    RUN_ALL=1
elif [ "$1" == "--runtime" ]; then
    RUN_RUNTIME=1
elif [ "$1" == "--plugins" ]; then
    RUN_PLUGINS=1
else
    # Interactive menu
    echo "Select benchmark to run:"
    echo "  1) Quick baseline benchmark (fastest)"
    echo "  2) All scenarios (comprehensive)"
    echo "  3) Runtime comparison"
    echo "  4) Plugin overhead analysis"
    echo "  5) Full suite (all of the above)"
    echo ""
    read -p "Enter choice [1-5]: " choice
    echo ""

    case $choice in
        1) RUN_QUICK=1 ;;
        2) RUN_ALL=1 ;;
        3) RUN_RUNTIME=1 ;;
        4) RUN_PLUGINS=1 ;;
        5) RUN_QUICK=1; RUN_ALL=1; RUN_RUNTIME=1; RUN_PLUGINS=1 ;;
        *) echo "Invalid choice. Exiting."; exit 1 ;;
    esac
fi

# Run selected benchmarks
FAILED=0

if [ $RUN_QUICK -eq 1 ]; then
    run_benchmark "quick-baseline" "test/benchmark/quick-bench.ts" || FAILED=1
fi

if [ $RUN_ALL -eq 1 ]; then
    run_benchmark "all-scenarios" "test/benchmark/all-scenarios.ts" || FAILED=1
fi

if [ $RUN_RUNTIME -eq 1 ]; then
    run_benchmark "runtime-comparison" "test/benchmark/runtime-comparison.ts" || FAILED=1
fi

if [ $RUN_PLUGINS -eq 1 ]; then
    run_benchmark "plugin-overhead" "test/benchmark/plugin-overhead.ts" || FAILED=1
fi

# Final summary
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                           BENCHMARK COMPLETE                              "
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Results saved to: $RESULTS_DIR${NC}"
echo ""
echo "Generated files:"
ls -lh "$RESULTS_DIR" | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
echo ""

if [ -f "$RESULTS_DIR/REPORT.md" ]; then
    echo -e "${GREEN}📊 Detailed report available at: $RESULTS_DIR/REPORT.md${NC}"
fi

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✨ All benchmarks completed successfully!${NC}\n"
    exit 0
else
    echo -e "\n${RED}⚠️  Some benchmarks failed. Check logs for details.${NC}\n"
    exit 1
fi

