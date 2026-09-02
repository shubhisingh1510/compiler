"use client";

import React, { useState } from "react";
import { DATASETS, benchmarkRows, BenchmarkRow } from "../lib/benchmark-data";

export function LatencyTable() {
  const [selectedDataset, setSelectedDataset] = useState<string>("large");

  const filteredRows = benchmarkRows.filter(
    (r) => r.dataset === selectedDataset
  );

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="font-mono text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>⏱️</span> Per-Operation Latency & Overhead Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exact timing measurements per operation in microseconds (µs)
          </p>
        </div>

        {/* Dataset selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400">Dataset:</label>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            {DATASETS.map((ds) => (
              <option key={ds} value={ds}>
                {ds} ({benchmarkRows.find((r) => r.dataset === ds)?.symbols} symbols)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Operation Explanation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-400 font-sans">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="font-mono font-semibold text-slate-200 block mb-1">
            📥 Insert (Declaration)
          </span>
          Deciding representation policy & writing entry into table structure.
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="font-mono font-semibold text-slate-200 block mb-1">
            🎯 Lookup (Hit)
          </span>
          Finding existing symbol & reconstructing prefix chain if compressed.
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="font-mono font-semibold text-slate-200 block mb-1">
            🔍 Lookup (Miss)
          </span>
          Confirming symbol absent (undefined variable or typo check).
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <span className="font-mono font-semibold text-slate-200 block mb-1">
            🔄 Scope Enter / Exit
          </span>
          Pushing/popping scope frame blocks during compilation.
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 text-left font-semibold">Implementation</th>
              <th className="py-3 px-4 text-right font-semibold">Memory / Sym</th>
              <th className="py-3 px-4 text-right font-semibold">Ratio</th>
              <th className="py-3 px-4 text-right font-semibold text-amber-400">Insert (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Hit (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Miss (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Scope Enter (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Scope Exit (µs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRows.map((r, i) => {
              const isBudget = r.implementation === "BudgetSym";
              const isInterned = r.implementation === "Interned";
              return (
                <tr
                  key={i}
                  className={`transition-colors ${
                    isBudget
                      ? "bg-teal-950/20 text-slate-100 font-semibold"
                      : "hover:bg-slate-900/40 text-slate-300"
                  }`}
                >
                  <td className="py-3 px-4 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isBudget
                          ? "bg-teal-400 shadow-sm shadow-teal-400/50"
                          : isInterned
                          ? "bg-indigo-400"
                          : "bg-slate-500"
                      }`}
                    />
                    <span className={isBudget ? "text-teal-300 font-bold" : ""}>
                      {r.implementation}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">
                    {r.memory_per_symbol.toFixed(2)} B
                  </td>
                  <td className="py-3 px-4 text-right text-teal-400 font-bold">
                    {r.compression_ratio.toFixed(2)}×
                  </td>
                  <td className="py-3 px-4 text-right font-numeric text-amber-300">
                    {r.insert_us.toFixed(3)}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">
                    {r.lookup_success_us.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">
                    {r.lookup_failure_us.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">
                    {r.scope_enter_us.toFixed(3)}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">
                    {r.scope_exit_us.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Trade-off Callout */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-200/90 font-sans">
        <span className="text-base">⚖️</span>
        <div>
          <strong className="font-mono text-amber-300 block mb-0.5">
            Honest Trade-off Analysis:
          </strong>
          BudgetSym trades higher insert latency (~2.76x baseline) for up to 2.37x memory compression. Insert involves policy evaluation (budget pressure check, prefix similarity scan, frequency tracking), while lookups pay a hash-then-reconstruct path when resolving compressed front-coded nodes.
        </div>
      </div>
    </div>
  );
}
