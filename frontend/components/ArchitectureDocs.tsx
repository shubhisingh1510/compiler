"use client";

import React from "react";

export function ArchitectureDocs() {
  const representations = [
    {
      name: "INLINE",
      color: "text-teal-400 border-teal-500/40 bg-teal-950/20",
      desc: "Small identifiers (< 12 chars) stored directly inside the symbol node buffer under low memory pressure.",
      overhead: "28 bytes fixed struct overhead + string length",
      useCase: "Loop counters (i, idx, count), short temp variables.",
    },
    {
      name: "INTERNED",
      color: "text-indigo-400 border-indigo-500/40 bg-indigo-950/20",
      desc: "Exact duplicate identifiers reference a single global string pool entry. Identifiers share underlying memory.",
      overhead: "28 bytes node pointer + shared pool node (32B + string length)",
      useCase: "Frequently repeated function names and global type declarations.",
    },
    {
      name: "COMPRESSED",
      color: "text-amber-400 border-amber-500/40 bg-amber-950/20",
      desc: "Prefix-similar identifiers (e.g. sensorReading1, sensorReading2) store front-coding delta relative to prior symbol.",
      overhead: "29 bytes link overhead + 1B suffix length + suffix characters",
      useCase: "HAL peripheral drivers, domain-specific structured identifier series.",
    },
  ];

  const facultyQuestions = [
    {
      q: "Isn't interning or front-coding standard compiler tech?",
      a: "Yes! String interning and front-coding are established techniques. BUDGET-SYM's contribution is the adaptive, budget/lifetime/frequency-aware unified policy that selects between three representations per identifier dynamically based on live memory pressure and access counts.",
    },
    {
      q: "What is the primary trade-off of BudgetSym?",
      a: "BudgetSym trades insertion and lookup latency for memory compression. Insertion requires evaluating policy thresholds, prefix matching, and budget tracking (~2.76x insertion cost on large datasets). Lookup pays a hash-and-reconstruct step for compressed nodes.",
    },
    {
      q: "How does runtime promotion work?",
      a: "When a compressed or interned symbol experiences high read activity (exceeding hotThreshold), it is dynamically upgraded to a faster direct representation, ensuring hot path operations are optimized.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-teal-400 font-mono text-xs font-semibold uppercase tracking-wider">
          <span>📚</span> Technical Architecture & Theoretical Foundation
        </div>
        <h2 className="text-xl font-mono font-bold text-slate-100">
          BUDGET-SYM Implementation Architecture
        </h2>
        <p className="text-xs text-slate-400 font-sans max-w-3xl leading-relaxed">
          BUDGET-SYM is designed for memory-bounded embedded compilation environments (e.g., microcontroller micro-compilers or embedded DSL parsers) where symbol table RAM footprint must stay strictly bounded.
        </p>
      </div>

      {/* 3 Storage Representations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {representations.map((rep) => (
          <div
            key={rep.name}
            className={`glass-panel p-5 rounded-2xl border ${rep.color} space-y-3`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-extrabold tracking-wider">
                ● {rep.name}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {rep.desc}
            </p>
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              <div>
                <strong className="text-slate-200">Overhead:</strong> {rep.overhead}
              </div>
              <div>
                <strong className="text-slate-200">Optimal Use Case:</strong> {rep.useCase}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Decision Flow Diagram */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
          <span>🔀</span> Policy Decision Logic (<code>decide()</code>)
        </h3>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2 leading-relaxed">
          <div className="text-teal-400 font-semibold">// Step 1: Memory Pressure Check</div>
          <div>pressure = current_tracked_bytes / budget_capacity_bytes</div>
          
          <div className="text-indigo-400 font-semibold pt-2">// Step 2: High Pressure Override</div>
          <div>IF pressure &gt;= HIGH_PRESSURE (85%) AND identifier_len &gt;= COMPRESS_MIN_LEN:</div>
          <div className="pl-4 text-amber-300">==&gt; Assign COMPRESSED</div>

          <div className="text-indigo-400 font-semibold pt-2">// Step 3: Prefix Similarity Match</div>
          <div>ELSE IF prefix_shared_len(last_inserted, name) &gt;= MIN_SHARED (4 chars):</div>
          <div className="pl-4 text-amber-300">==&gt; Assign COMPRESSED</div>

          <div className="text-indigo-400 font-semibold pt-2">// Step 4: Low Pressure Small Identifiers</div>
          <div>ELSE IF identifier_len &lt; INLINE_MAX_LEN (12 chars) AND pressure &lt; LOW_PRESSURE (50%):</div>
          <div className="pl-4 text-teal-300">==&gt; Assign INLINE</div>

          <div className="text-indigo-400 font-semibold pt-2">// Step 5: Default Fallback</div>
          <div>ELSE:</div>
          <div className="pl-4 text-indigo-300">==&gt; Assign INTERNED</div>
        </div>
      </div>

      {/* Faculty Q&A Backup */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
          <span>🎓</span> Faculty Review Q&A & Defense Positioning
        </h3>

        <div className="space-y-3">
          {facultyQuestions.map((qa, i) => (
            <div key={i} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <h4 className="font-mono text-xs font-bold text-teal-300">
                Q: {qa.q}
              </h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {qa.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
