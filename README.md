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

---

## Quick Start & Running Commands

### ⚙️ Backend (C++ Compiler Engine & Python Environment)

#### 1. Build and Run All C++ Components & Plotting
Run the comprehensive build script to compile all C++ binaries, execute tests, run benchmarks, and generate visualization plots:

```bash
./build.sh
```

#### 2. Running C++ Components Individually

- **Correctness Smoke Tests**:
  ```bash
  g++ -std=c++14 -O2 -Wall -Wextra tests/smoke_test.cpp -o tests/smoke_test.exe && ./tests/smoke_test.exe
  ```
- **Interactive Live Walkthrough Demo**:
  ```bash
  g++ -std=c++14 -O2 -Wall -Wextra src/demo_main.cpp -o budget_sym_demo.exe && ./budget_sym_demo.exe
  ```
- **Benchmark Suite** (generates `results/benchmark_results.csv` across 8 datasets):
  ```bash
  g++ -std=c++14 -O2 -Wall -Wextra src/benchmark_main.cpp -o benchmark.exe && ./benchmark.exe
  ```
- **Ablation Suite** (generates `results/ablation_results.csv` isolating mechanisms):
  ```bash
  g++ -std=c++14 -O2 -Wall -Wextra src/ablation_main.cpp -o ablation.exe && ./ablation.exe
  ```

#### 3. Python Plotting & Virtual Environment

Set up the Python virtual environment and run the plot generator script:

```bash
# Create virtual environment & install dependencies
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Generate PNG charts in figures/ from CSV results
./venv/bin/python3 scripts/plot_results.py
```

---

### 💻 Frontend (Next.js Interactive Web Dashboard)

The project includes a Next.js 16 + React 19 + Tailwind CSS web dashboard and live client-side symbol table simulator.

#### Commands to Run the Frontend:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (if not already installed)
npm install

# 3. Start the Development Server
npm run dev
```

Open your browser at `http://localhost:3000` (or `http://localhost:3001` if port 3000 is occupied) to view the application.

#### Production Build Commands:

```bash
# Build production bundle
cd frontend
npm run build

# Start production server
npm run start
```

#### Standalone HTML Dashboard (Alternative):
If you prefer a zero-dependency single-file HTML dashboard without Node.js:
```bash
xdg-open dashboard.html
```

---

## Layout

```
include/                 Header-only C++ implementations (Conventional, Interned, BudgetSym, memory tracker, timer)
src/demo_main.cpp        -> budget_sym_demo.exe (live interactive demonstration)
src/benchmark_main.cpp   -> benchmark.exe (8-dataset x 3-implementation comparison)
src/ablation_main.cpp    -> ablation.exe (4-variant mechanism isolation)
tests/smoke_test.cpp     -> tests/smoke_test.exe (assert-based correctness checks)
scripts/plot_results.py  CSV -> figures/*.png plot script
frontend/                Next.js + React + Tailwind CSS web dashboard and live simulator
venv/                    Python virtual environment for plotting scripts
requirements.txt         Python package dependencies (matplotlib, pandas, numpy)
dashboard.html           Standalone HTML fallback metrics dashboard & playground
results/                 benchmark_results.csv, ablation_results.csv (generated measured data)
figures/                 5 PNG charts generated from results CSVs
docs/                    Research gap, novelty, methodology, architecture, experiment plan, Q&A
DEMO.md                  5-minute presentation plan for faculty review
```

## Headline Result (from `results/benchmark_results.csv`)

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

## What's Proposed vs. What's Established

See `docs/research_gap.md` and `docs/novelty.md` for the full breakdown. In
short: interning, front-coding, and scope-stack symbol tables are all
existing techniques, used here as baselines or as one representation among
three. The **proposed** part is the unified, budget/lifetime/frequency-aware
policy that chooses between them per symbol, and that adapts the choice
after insertion based on real access counts.
