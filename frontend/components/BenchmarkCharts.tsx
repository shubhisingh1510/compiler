"use client";

import React, { useState } from "react";
import { DATASETS, rowFor, BenchmarkRow } from "../lib/benchmark-data";

type MetricMode = "ratio" | "memory" | "per_symbol";

export function BenchmarkCharts() {
  const [metric, setMetric] = useState<MetricMode>("ratio");
  const [hoveredDataset, setHoveredDataset] = useState<string | null>(null);

  const getVal = (row: BenchmarkRow | undefined) => {
    if (!row) return 0;
    if (metric === "ratio") return row.compression_ratio;
    if (metric === "memory") return row.memory_bytes;
    return row.memory_per_symbol;
  };

  const getMaxVal = () => {
    if (metric === "ratio") return 2.6;
    if (metric === "memory") return 1400000;
    return 90;
  };

  const formatVal = (val: number) => {
    if (metric === "ratio") return `${val.toFixed(2)}×`;
    if (metric === "memory") return `${(val / 1024).toFixed(1)} kB`;
    return `${val.toFixed(1)} B`;
  };

  const maxVal = getMaxVal();

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="font-mono text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>📊</span> Benchmark Dataset Analysis
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real measured results comparing Conventional, Interned, and BudgetSym symbol tables
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMetric("ratio")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              metric === "ratio"
                ? "bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Compression Ratio
          </button>
          <button
            onClick={() => setMetric("memory")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              metric === "memory"
                ? "bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Total Bytes
          </button>
          <button
            onClick={() => setMetric("per_symbol")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              metric === "per_symbol"
                ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Bytes / Symbol
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-slate-600 inline-block" />
          <span>Conventional Baseline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
          <span>Interned Symbol Table</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-teal-400 inline-block" />
          <span className="text-teal-300 font-semibold">BudgetSym (Adaptive)</span>
        </div>
      </div>

      {/* Bar Chart Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4">
        {DATASETS.map((ds) => {
          const conv = rowFor(ds, "Conventional");
          const interned = rowFor(ds, "Interned");
          const budget = rowFor(ds, "BudgetSym");

          const cVal = getVal(conv);
          const iVal = getVal(interned);
          const bVal = getVal(budget);

          const cH = Math.min(100, Math.max(8, (cVal / maxVal) * 100));
          const iH = Math.min(100, Math.max(8, (iVal / maxVal) * 100));
          const bH = Math.min(100, Math.max(8, (bVal / maxVal) * 100));

          const isHovered = hoveredDataset === ds;

          return (
            <div
              key={ds}
              onMouseEnter={() => setHoveredDataset(ds)}
              onMouseLeave={() => setHoveredDataset(null)}
              className={`flex flex-col items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                isHovered ? "bg-slate-800/80 border border-slate-700 shadow-lg" : "bg-slate-900/40 border border-slate-800/50"
              }`}
            >
              {/* Bars Container */}
              <div className="h-44 w-full flex items-end justify-center gap-1.5 border-b border-slate-800 pb-2 px-1 relative">
                {/* Conventional Bar */}
                <div
                  className="w-1/3 bg-slate-600 rounded-t transition-all duration-500 relative group"
                  style={{ height: `${cH}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-slate-900 text-slate-300 px-1 py-0.5 rounded border border-slate-700 whitespace-nowrap z-20">
                    {formatVal(cVal)}
                  </span>
                </div>

                {/* Interned Bar */}
                <div
                  className="w-1/3 bg-indigo-500/80 rounded-t transition-all duration-500 relative group"
                  style={{ height: `${iH}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-slate-900 text-indigo-300 px-1 py-0.5 rounded border border-slate-700 whitespace-nowrap z-20">
                    {formatVal(iVal)}
                  </span>
                </div>

                {/* BudgetSym Bar */}
                <div
                  className="w-1/3 bg-teal-400 rounded-t shadow-lg glow-teal transition-all duration-500 relative group"
                  style={{ height: `${bH}%` }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-slate-900 text-teal-300 px-1 py-0.5 rounded border border-teal-500/40 font-bold whitespace-nowrap z-20">
                    {formatVal(bVal)}
                  </span>
                </div>
              </div>

              {/* Dataset Name */}
              <div className="text-center">
                <div className="font-mono text-[11px] font-medium text-slate-300 truncate max-w-[100px]" title={ds}>
                  {ds}
                </div>
                <div className="font-mono text-[10px] text-teal-400 font-semibold mt-0.5">
                  {formatVal(bVal)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
