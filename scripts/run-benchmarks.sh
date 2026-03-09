#!/bin/bash
# API Response Time Benchmark Script
# Runs hey against 5 endpoints at concurrency 10, 25, 50
# Outputs raw results to /tmp/bench_results/

set -euo pipefail

SESSION_ID=$(grep session_id /tmp/bench_cookies.txt | awk '{print $NF}')
DOC_ID="55e8da6f-83e4-4717-8fa0-893ae74cfb40"
RESULTS_DIR="/tmp/bench_results"
mkdir -p "$RESULTS_DIR"

ENDPOINTS=(
  "issues|http://localhost:3000/api/issues"
  "document|http://localhost:3000/api/documents/$DOC_ID"
  "projects|http://localhost:3000/api/projects"
  "weeks|http://localhost:3000/api/weeks"
  "programs|http://localhost:3000/api/programs"
)

CONCURRENCIES=(10 25 50)

for entry in "${ENDPOINTS[@]}"; do
  IFS='|' read -r name url <<< "$entry"
  for c in "${CONCURRENCIES[@]}"; do
    echo "=== $name @ concurrency $c ==="
    outfile="$RESULTS_DIR/${name}_c${c}.txt"
    hey -n 200 -c "$c" -H "Cookie: session_id=$SESSION_ID" "$url" > "$outfile" 2>&1
    # Extract key metrics
    grep -A 20 "Latency distribution" "$outfile" || true
    echo ""
  done
done

echo "All benchmarks complete. Results in $RESULTS_DIR"
