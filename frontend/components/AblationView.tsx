"use client";

import React from "react";
import { ablationRows, AblationRow } from "../lib/benchmark-data";

export function AblationView() {
  const getVariantLabel = (v: string) => {
    switch (v) {
      case "BudgetSym-Full":
        return { title: "BudgetSym — Full Policy", desc: "All mechanisms enabled (Scope Stack, Access Freq, Adaptive Policy)", isFull: true };
      case "BudgetSym-NoScope":
        return { title: "Ablation: No Scope Stack", desc: "Removes scope stack lifecycle management", isFull: false };
      case "BudgetSym-NoAccessFrequency":
        return { title: "Ablation: No Access Frequency", desc: "Disables runtime hot-symbol promotions", isFull: false };
      case "BudgetSym-NoAdaptiveSelection":
        return { title: "Ablation: No Adaptive Selection", desc: "Forces fixed representation without dynamic pressure checks", isFull: false };
      default:
        return { title: v, desc: "", isFull: false };
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-teal-400 font-mono text-sm font-semibold uppercase tracking-wider">
          <span>🔬</span> Ablation Study (Mechanism Isolation)
        </div>
        <h2 className="text-xl font-mono font-bold text-slate-100">
          Which policy mechanism contributes how much to the result?
        </h2>
        <p className="text-xs text-slate-400 font-sans max-w-3xl leading-relaxed">
          To verify that every component in BudgetSym earns its place, each mechanism was systematically disabled in isolation across 800–1200 symbol benchmark workloads. Below are the measured impacts on memory footprint, runtime promotions, insert/lookup latency, and total bytes reclaimed.
        </p>
      </div>

      {/* Grid of Ablation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ablationRows.map((row) => {
          const info = getVariantLabel(row.variant);
          return (
            <div
              key={row.variant}
              className={`glass-panel p-5 rounded-2xl border transition-all duration-300 ${
                info.isFull
                  ? "border-teal-500/50 bg-teal-950/20 shadow-xl glow-teal"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    info.isFull
                      ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {info.isFull ? "Baseline Full" : "Variant"}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {row.symbols} symbols
                </span>
              </div>

              <h3 className="font-mono text-sm font-bold text-slate-100 mb-1">
                {info.title}
              </h3>
              <p className="text-xs text-slate-400 font-sans mb-4 min-h-[32px]">
                {info.desc}
              </p>

              <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Memory / Symbol</span>
                  <span className="font-bold text-teal-400">
                    {row.memory_per_symbol.toFixed(2)} B
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Promotions</span>
                  <span className={row.promotions > 0 ? "text-amber-400 font-bold" : "text-slate-500"}>
                    {row.promotions}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Insert Latency</span>
                  <span>{row.insert_us.toFixed(3)} µs</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Lookup Latency</span>
                  <span>{row.lookup_us.toFixed(3)} µs</span>
                </div>
                <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/60 pt-2">
                  <span className="text-slate-400">Bytes Reclaimed</span>
                  <span className="font-bold text-indigo-400">
                    {row.bytes_reclaimed_total.toLocaleString()} B
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
