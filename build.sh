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

echo ""
echo "== Running smoke test =="
./tests/smoke_test.exe

echo ""
echo "== Running benchmark (writes results/benchmark_results.csv) =="
./benchmark.exe

echo ""
echo "== Running ablation (writes results/ablation_results.csv) =="
./ablation.exe

echo ""
echo "== Generating figures (requires python + matplotlib + pandas is NOT required, csv module only) =="
python scripts/plot_results.py || python3 scripts/plot_results.py

echo ""
echo "All done. Run ./budget_sym_demo.exe for the live walkthrough."
