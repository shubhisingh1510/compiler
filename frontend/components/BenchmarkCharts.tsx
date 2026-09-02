"use client";

import React, { useEffect, useState } from "react";
import { DATASETS as fallbackDatasets, benchmarkRows as fallbackRows, BenchmarkRow } from "../lib/benchmark-data";

type MetricMode = "ratio" | "memory" | "per_symbol";

export function BenchmarkCharts() {
  const [metric, setMetric] = useState<MetricMode>("ratio");
  const [hoveredDataset, setHoveredDataset] = useState<string | null>(null);
  const [rows, setRows] = useState<BenchmarkRow[]>(fallbackRows);
  const [source, setSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    fetch("/api/benchmarks")
      .then((r) => r.json())
      .then((data) => {
        if (data.available && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  const datasets = source === "live" ? Array.from(new Set(rows.map((r) => r.dataset))) : fallbackDatasets;
  const rowFor = (ds: string, impl: string) => rows.find((r) => r.dataset === ds && r.implementation === impl);

  const getVal = (row: BenchmarkRow | undefined) => {
    if (!row) return 0;
    if (metric === "ratio") return row.compression_ratio;
    if (metric === "memory") return row.memory_bytes;
    return row.memory_per_symbol;
  };

  const getMaxVal = () => {
    if (metric === "ratio") return Math.max(2.6, ...rows.map((r) => r.compression_ratio));
    if (metric === "memory") return Math.max(1400000, ...rows.map((r) => r.memory_bytes));
    return Math.max(90, ...rows.map((r) => r.memory_per_symbol));
  };

  const formatVal = (val: number) => {
    if (metric === "ratio") return `${val.toFixed(2)}×`;
    if (metric === "memory") return `${(val / 1024).toFixed(1)} kB`;
    return `${val.toFixed(1)} B`;
  };

  const maxVal = getMaxVal();

  return (
    <div className="panel p-6 rounded-2xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="font-mono text-base font-semibold text-slate-900">
            Benchmark Dataset Analysis
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Real measured results comparing Conventional, Interned, and BudgetSym symbol tables
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${source === "live" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {source === "live" ? "results/benchmark_results.csv" : "bundled snapshot"}
          </span>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {([
              { id: "ratio", label: "Compression Ratio", accent: "teal" },
              { id: "memory", label: "Total Bytes", accent: "indigo" },
              { id: "per_symbol", label: "Bytes / Symbol", accent: "amber" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMetric(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  metric === opt.id
                    ? opt.accent === "teal"
                      ? "bg-teal-50 text-teal-700 font-semibold border border-teal-200"
                      : opt.accent === "indigo"
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                      : "bg-amber-50 text-amber-700 font-semibold border border-amber-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
          <span>Conventional Baseline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-indigo-400 inline-block" />
          <span>Interned Symbol Table</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-teal-500 inline-block" />
          <span className="text-teal-700 font-semibold">BudgetSym (Adaptive)</span>
        </div>
      </div>

      {/* Bar Chart Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4">
        {datasets.map((ds) => {
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
              className={`flex flex-col items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${
                isHovered ? "bg-slate-50 border-slate-300 shadow-sm" : "bg-white border-slate-100"
              }`}
            >
              {/* Bars Container */}
              <div className="h-44 w-full flex items-end justify-center gap-1.5 border-b border-slate-200 pb-2 px-1 relative">
                <div className="w-1/3 bg-slate-300 rounded-t transition-all duration-500 relative group" style={{ height: `${cH}%` }}>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                    {formatVal(cVal)}
                  </span>
                </div>
                <div className="w-1/3 bg-indigo-400 rounded-t transition-all duration-500 relative group" style={{ height: `${iH}%` }}>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                    {formatVal(iVal)}
                  </span>
                </div>
                <div className="w-1/3 bg-teal-500 rounded-t shadow-sm transition-all duration-500 relative group" style={{ height: `${bH}%` }}>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-teal-700 text-white px-1.5 py-0.5 rounded font-bold whitespace-nowrap z-20">
                    {formatVal(bVal)}
                  </span>
                </div>
              </div>

              {/* Dataset Name */}
              <div className="text-center">
                <div className="font-mono text-[11px] font-medium text-slate-600 truncate max-w-[100px]" title={ds}>
                  {ds}
                </div>
                <div className="font-mono text-[10px] text-teal-700 font-semibold mt-0.5">
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
