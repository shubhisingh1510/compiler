"use client";

import React from "react";

const SECTIONS = [
  {
    title: "Problem",
    body: "Embedded compilation environments have constrained memory, while conventional symbol tables can carry significant string, metadata, and indexing overhead. A compiler for a memory-bounded target can't always afford a conventional table's peak memory, but also can't uniformly pay a compression scheme's lookup-time cost for every identifier — including ones on a hot path.",
  },
  {
    title: "Motivation",
    body: "Neither extreme — always fast (conventional) or always compact (uniform compression/interning) — fits a resource-constrained compiler well on its own. The gap is a per-symbol decision that reacts to live conditions: current memory pressure, scope/lifetime, and how often a symbol is actually accessed.",
  },
  {
    title: "Existing Approaches",
    body: "Conventional hash table (unordered_map<string, Symbol>, one full string copy per symbol). String interning (shared, refcounted pool — only saves memory on exact repeats). Compressed/trie-based dictionaries (front-coding, applied uniformly across the whole table). All three are established techniques; none make a per-symbol decision using a unified, compiler-aware memory-budget policy.",
  },
  {
    title: "Research Gap",
    body: "None of the three techniques make a representation decision using live signals from the compilation environment — memory pressure, exact-repeat status, prefix similarity to the previous declaration, and observed access frequency, combined into one policy, and revisited after insertion as real access patterns emerge.",
  },
  {
    title: "Proposed Architecture",
    body: "BUDGET-SYM: a symbol table that chooses per-symbol between INLINE, INTERNED, and COMPRESSED representations via a single decide() policy, and that promotes a COMPRESSED entry to INTERNED once it proves \"hot\" at runtime — trading its memory saving for faster lookup. Built on established techniques (interning, front-coding, scope stacks), not inventing them.",
  },
  {
    title: "Research Questions",
    body: "Can a symbol table that adapts its per-symbol representation to memory pressure, scope/lifetime, and observed access frequency measurably beat both a conventional table and a plain interning table on the same workload — on both memory and lookup latency, not just one? This is answered empirically (results/benchmark_results.csv, results/ablation_results.csv), not asserted.",
  },
  {
    title: "Evaluation Metrics",
    body: "Tracked memory (a documented cost model, not OS RSS), memory per symbol, compression ratio vs. the conventional baseline, insert/lookup latency (hit and miss), scope enter/exit latency, and — in the ablation study — promotions and bytes reclaimed per mechanism.",
  },
  {
    title: "Limitations",
    body: "Real-world corpus evaluation (FreeRTOS/Arduino/Zephyr) needs the user to vendor those codebases locally (see docs/corpus_setup.md) — the extraction and benchmark tooling is built and verified, but not yet run against real corpora in this environment. COMPRESSED chain-interior reclamation is incomplete — an interior node's bytes can't always be physically freed without breaking descendants' decode chain.",
  },
  {
    title: "Future Work",
    body: "Multi-seed statistical significance testing — implemented: 30 seeds per dataset, 95% confidence intervals and p-values, see results/multiseed_summary.csv. Threshold grid search over the policy's configuration — implemented: 15,000-config sweep, see results/grid_search_full.csv and results/optimal_policy.csv. Real embedded-codebase identifier traffic instead of synthetic datasets — tooling implemented, pending real corpora (see results/corpus_results.csv once run). A compacting pass for COMPRESSED chain-interior fragmentation.",
  },
];

const FACULTY_QA = [
  { q: "Isn't interning or front-coding standard compiler tech?", a: "Yes. String interning and front-coding are established techniques, used here as baselines (or as one representation among three). BUDGET-SYM's proposed contribution is the adaptive, budget/lifetime/frequency-aware unified policy that selects between three representations per identifier, and revisits that choice after insertion." },
  { q: "What is the primary trade-off?", a: "Memory for latency. BudgetSym's insert is consistently the slowest of the three implementations (more decision logic per symbol), and its lookup is somewhat slower than both baselines due to the hash-then-reconstruct lookup path every entry uses. This is reported unprompted, not hidden." },
  { q: "How does runtime promotion work?", a: "When a COMPRESSED symbol's real access count crosses hotAccessThreshold, it is upgraded to INTERNED, trading its memory saving for faster lookup — a genuinely adaptive, post-insertion decision, not just a one-shot choice at declaration time." },
];

export function ResearchContent() {
  return (
    <div className="space-y-8">
      <div className="panel p-6 rounded-2xl space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Research</h1>
        <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
          We do not claim this is the first adaptive data structure, or the first use of
          front-coding. What follows states the actual research positioning plainly — see
          docs/research_gap.md and docs/novelty.md in the repository for the full text.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <div key={s.title} className="panel rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-2">{s.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="panel p-6 rounded-2xl space-y-4">
        <h3 className="font-mono text-sm font-bold text-slate-900">Faculty Q&amp;A</h3>
        <div className="space-y-3">
          {FACULTY_QA.map((qa, i) => (
            <div key={i} className="panel-soft p-4 rounded-xl space-y-1">
              <h4 className="font-mono text-xs font-bold text-indigo-700">Q: {qa.q}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{qa.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
