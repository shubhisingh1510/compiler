"use client";

import React from "react";

function Code({ children }: { children: string }) {
  return (
    <pre className="panel-soft rounded-xl p-4 text-[11px] font-mono text-slate-700 overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel rounded-2xl p-6 space-y-3 scroll-mt-24">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

const TOC = [
  ["getting-started", "Getting Started"],
  ["architecture", "Architecture"],
  ["api", "API"],
  ["representations", "Symbol Representations"],
  ["memory-model", "Memory Model"],
  ["methodology", "Benchmark Methodology"],
  ["experiments", "Experiments"],
  ["limitations", "Limitations"],
] as const;

export function DocumentationContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3">
        <nav className="panel rounded-2xl p-4 sticky top-24 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 px-2">On this page</div>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-700">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="lg:col-span-9 space-y-6">
        <Section id="getting-started" title="Getting Started">
          <p className="text-xs text-slate-600 leading-relaxed">Build the C++ core, then run the frontend:</p>
          <Code>{`# From the repo root
./build.sh                     # builds smoke_test, budget_sym_demo, benchmark, ablation
g++ -std=c++14 -O2 src/analyze_main.cpp -o analyze.exe   # the web backend's engine

cd frontend
npm install
npm run dev                    # http://localhost:3000

# or, single command from the repo root:
./start.sh`}</Code>
        </Section>

        <Section id="architecture" title="Architecture">
          <p className="text-xs text-slate-600 leading-relaxed">
            Source → lightweight extractor (frontend/lib/extract.ts, heuristic, not a real parser)
            → event stream → src/analyze_main.cpp → the real BudgetSym engine (include/budget_sym.hpp)
            → JSON → the web dashboard. Full interactive diagram on the{" "}
            <a href="/architecture" className="text-indigo-600 hover:underline">Architecture page</a>.
          </p>
        </Section>

        <Section id="api" title="API">
          <p className="text-xs text-slate-600 leading-relaxed">All routes are Next.js API routes (Node.js runtime), served from the frontend app.</p>
          <div className="space-y-3">
            <ApiRow method="POST" path="/api/analyze" desc="Body: { code, budgetBytes?, config? }. Extracts declarations/scopes from code, runs them through analyze.exe, returns the real result." />
            <ApiRow method="GET" path="/api/benchmarks" desc="Reads results/benchmark_results.csv fresh from disk. { available, rows } — honest empty state if the file is missing." />
            <ApiRow method="GET" path="/api/experiments" desc="Reads results/ablation_results.csv fresh from disk. Same shape as /api/benchmarks." />
            <ApiRow method="GET" path="/api/status" desc="Filesystem checks: is analyze.exe built, do the result CSVs exist. Backs the Dashboard's system-status hero." />
          </div>
        </Section>

        <Section id="representations" title="Symbol Representations">
          <p className="text-xs text-slate-600 leading-relaxed">
            INLINE (short, low pressure), INTERNED (exact repeats + default fallback), COMPRESSED
            (front-coded against the previous declaration). Exact decision order and overhead
            model on the <a href="/architecture" className="text-indigo-600 hover:underline">Architecture page</a>.
          </p>
        </Section>

        <Section id="memory-model" title="Memory Model">
          <p className="text-xs text-slate-600 leading-relaxed">
            &quot;Tracked Memory&quot; is a documented, deterministic sum of per-entry byte costs
            computed from real stored data lengths plus fixed, documented bookkeeping constants —
            not an OS-level RSS measurement. This is stated everywhere the number is shown. See{" "}
            <code className="bg-slate-100 px-1 rounded">docs/methodology.md</code> in the repository for the exact cost table per representation.
          </p>
        </Section>

        <Section id="methodology" title="Benchmark Methodology">
          <p className="text-xs text-slate-600 leading-relaxed">
            8 deterministic, seeded synthetic datasets (small, medium, large, high-prefix-similarity,
            random-identifiers, nested-scopes, hot-cold-access, memory-stress) × 3 implementations.
            Timing uses a custom high-resolution timer (<code className="bg-slate-100 px-1 rounded">include/hires_timer.hpp</code>) because
            this toolchain&apos;s <code className="bg-slate-100 px-1 rounded">std::chrono::steady_clock</code> was found not to work — see{" "}
            <a href="/research" className="text-indigo-600 hover:underline">Research</a> for how that was caught.
          </p>
        </Section>

        <Section id="experiments" title="Experiments">
          <p className="text-xs text-slate-600 leading-relaxed">
            Ablation isolates each mechanism (scope reclamation, access-frequency promotion,
            adaptive selection itself) on one fixed shared workload — see the{" "}
            <a href="/experiments" className="text-indigo-600 hover:underline">Experiments page</a>.
          </p>
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
            <li>The extractor is a heuristic, not a real C/C++ parser — see the warning banner it produces on the Compiler page for anything it couldn&apos;t confidently interpret.</li>
            <li>Single-run measurements, not multi-seed statistics.</li>
            <li>Synthetic benchmark datasets, not real compiler traffic.</li>
            <li>COMPRESSED chain-interior reclamation is incomplete (documented in the C++ source).</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 text-xs">
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-56">
        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{method}</span>
        <span className="font-mono text-slate-800">{path}</span>
      </div>
      <span className="text-slate-500">{desc}</span>
    </div>
  );
}
