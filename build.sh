#!/usr/bin/env bash
# BUDGET-SYM build script. No CMake / make available in the target
# environment (verified), so this is a flat, explicit set of g++ invocations.
# Run from the repo root: ./build.sh
set -e

CXX=${CXX:-g++}
STD=-std=c++14   # this toolchain (MinGW.org GCC 6.3.0) lacks C++17 stdlib headers -- see docs/methodology.md
FLAGS="$STD -O2 -Wall -Wextra"

echo "== Building smoke test =="
$CXX $FLAGS tests/smoke_test.cpp -o tests/smoke_test.exe

echo "== Building CLI demo (budget_sym_demo) =="
$CXX $FLAGS src/demo_main.cpp -o budget_sym_demo.exe

echo "== Building benchmark =="
$CXX $FLAGS src/benchmark_main.cpp -o benchmark.exe

echo "== Building ablation =="
$CXX $FLAGS src/ablation_main.cpp -o ablation.exe

echo "== Building analyze (web dashboard's real backend engine) =="
$CXX $FLAGS src/analyze_main.cpp -o analyze.exe

echo "== Building grid search (Review-2: threshold optimization) =="
$CXX $FLAGS src/grid_search_main.cpp -o grid_search.exe

echo "== Building multiseed (Review-2: statistical validation) =="
$CXX $FLAGS src/multiseed_main.cpp -o multiseed.exe

echo "== Building corpus_bench (Review-2: real-world corpus evaluation) =="
$CXX $FLAGS src/corpus_bench_main.cpp -o corpus_bench.exe

echo ""
echo "== Running smoke test =="
./tests/smoke_test.exe

echo ""
echo "== Running benchmark (writes results/benchmark_results.csv) =="
./benchmark.exe

echo ""
echo "== Running ablation (writes results/ablation_results.csv) =="
./ablation.exe

# Grid search sweeps 15,000 configs and takes several minutes; skip on quick
# iteration cycles with RUN_GRID_SEARCH=0.
if [ "${RUN_GRID_SEARCH:-1}" = "1" ]; then
    echo ""
    echo "== Running grid search (writes results/grid_search_full.csv, results/optimal_policy.csv; several minutes) =="
    ./grid_search.exe
else
    echo ""
    echo "== Skipping grid search (RUN_GRID_SEARCH=0) =="
fi

echo ""
echo "== Running multiseed (writes results/multiseed_raw.csv) =="
./multiseed.exe

echo ""
echo "== Computing multiseed statistics (writes results/multiseed_summary.csv) =="
python scripts/multiseed_stats.py || python3 scripts/multiseed_stats.py

echo ""
echo "== Real-world corpus evaluation (Review-2) =="
CORPORA_FOUND=0
for corpus in freertos arduino-core zephyr; do
    if [ -d "corpora/$corpus" ]; then
        CORPORA_FOUND=1
        echo "  -- extracting + benchmarking $corpus --"
        (python scripts/extract_identifiers.py "corpora/$corpus" "results/corpus_ids_${corpus}.txt" || \
         python3 scripts/extract_identifiers.py "corpora/$corpus" "results/corpus_ids_${corpus}.txt")
        ./corpus_bench.exe "results/corpus_ids_${corpus}.txt" "$corpus"
    fi
done
if [ "$CORPORA_FOUND" = "0" ]; then
    echo "  no corpora vendored under corpora/ -- skipping real-world eval, see docs/corpus_setup.md"
fi

echo ""
echo "== Generating figures (requires python + matplotlib + pandas is NOT required, csv module only) =="
python scripts/plot_results.py || python3 scripts/plot_results.py

echo ""
echo "All done. Run ./budget_sym_demo.exe for the live walkthrough."
