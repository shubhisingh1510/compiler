# BUDGET-SYM

**An Adaptive Scope-Aware Symbol Table for Memory-Bounded Embedded Compilation**

A prototype (not a claim of theoretical optimality -- see `docs/novelty.md`)
compiler symbol table that picks, per identifier, between three storage
representations -- **INLINE**, **INTERNED**, **COMPRESSED** -- based on live
memory pressure, scope/lifetime, exact-repeat status, prefix similarity to
the previous declaration, and observed access frequency (with runtime
promotion once an entry proves "hot"). Benchmarked against two baselines
(`ConventionalSymbolTable`, `InternedSymbolTable`) on 8 synthetic datasets,
and ablated to isolate which mechanism contributes how much of the result.
Every number in `results/` and `figures/` comes from actually running this
code -- see `docs/methodology.md` for the exact accounting model and two real
toolchain bugs caught and fixed while building this.

## Quick start

```bash
./build.sh                # builds everything, runs tests + benchmark + ablation + plots
./budget_sym_demo.exe      # live walkthrough (see DEMO.md for the 5-minute version)
```

No CMake or `make` in this environment -- `build.sh` is a flat sequence of
`g++ -std=c++14` invocations. See `docs/methodology.md` for why C++14 (not
C++17) and why a custom timer (`include/hires_timer.hpp`) instead of
`std::chrono`.

## Layout

```
include/           header-only implementations (Conventional, Interned, BudgetSym, memory tracker, timer)
src/demo_main.cpp        -> budget_sym_demo.exe   live demonstration
src/benchmark_main.cpp   -> benchmark.exe          8-dataset x 3-implementation comparison
src/ablation_main.cpp    -> ablation.exe           4-variant mechanism isolation
tests/smoke_test.cpp     -> tests/smoke_test.exe   correctness checks (assert-based)
scripts/plot_results.py                            CSV -> figures/*.png
results/            benchmark_results.csv, ablation_results.csv (generated, real)
figures/            5 PNGs generated from the CSVs above
docs/                research_gap, novelty, methodology, architecture, experiment_plan,
                     future_work, faculty_questions
DEMO.md              the 5-minute presentation plan for tomorrow's review
```

## Headline result (from `results/benchmark_results.csv`, this run)

Across 8 datasets, BudgetSym's tracked-memory **compression ratio vs the
conventional baseline** ranges from **1.24x** (`random-identifiers`, the
least favorable case) to **2.37x** (`high-prefix-similarity`), beating plain
string interning (which only reaches ~1.05x-1.07x on every dataset) in every
single case. The cost: BudgetSym's insert is consistently the slowest of the
three (more decision logic per symbol), and its lookup is somewhat slower
than both baselines due to the hash-then-reconstruct lookup path every
BudgetSym entry uses. This is a memory-for-latency trade, reported honestly
in both directions -- not a strict win, and we don't present it as one. Full
breakdown, including where the adaptive policy does and doesn't help, in
`docs/novelty.md` and `docs/faculty_questions.md`.

## What's proposed vs. what's established

See `docs/research_gap.md` and `docs/novelty.md` for the full breakdown. In
short: interning, front-coding, and scope-stack symbol tables are all
existing techniques, used here as baselines or as one representation among
three. The **proposed** part is the unified, budget/lifetime/frequency-aware
policy that chooses between them per symbol, and that adapts the choice
after insertion based on real access counts.
