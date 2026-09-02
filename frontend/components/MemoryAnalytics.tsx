"use client";

import React, { useEffect, useState } from "react";
import { benchmarkRows as fallbackRows, DATASETS, BenchmarkRow } from "../lib/benchmark-data";

export function MemoryAnalytics() {
  const [rows, setRows] = useState<BenchmarkRow[]>(fallbackRows);
  const [source, setSource] = useState<"live" | "fallback">("fallback");
  const [latencyMetric, setLatencyMetric] = useState<"insert_us" | "lookup_success_us">("insert_us");

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

  const budgetRows = DATASETS.map((ds) => rowFor2(rows, ds, "BudgetSym")).filter(Boolean) as BenchmarkRow[];
  const memoryStress = rowFor2(rows, "memory-stress", "BudgetSym");
  const memoryStressConv = rowFor2(rows, "memory-stress", "Conventional");
  const largeRow = rowFor2(rows, "large", "BudgetSym");
  const largeConv = rowFor2(rows, "large", "Conventional");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Memory Overview</h2>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${source === "live" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
          {source === "live" ? "results/benchmark_results.csv" : "bundled snapshot"}
        </span>
      </div>

      {/* Budget vs Pressure spotlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel rounded-2xl p-5">
          <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Budget Sensitivity — memory-stress dataset
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            The only dataset run under a deliberately tiny budget (8,192 B vs 64 MB for the
            others) — this is the one real budget-pressure data point the benchmark suite
            produces; we don&apos;t claim a full budget sweep since one wasn&apos;t run.
          </p>
          {memoryStress && memoryStressConv ? (
            <div className="flex items-end gap-6 h-32">
              <MiniBar label="Conventional" value={memoryStressConv.memory_bytes} max={memoryStressConv.memory_bytes} color="bg-slate-300" />
              <MiniBar label="BudgetSym" value={memoryStress.memory_bytes} max={memoryStressConv.memory_bytes} color="bg-teal-500" highlight={`${memoryStress.compression_ratio.toFixed(2)}×`} />
            </div>
          ) : <div className="text-xs text-slate-400">Data unavailable.</div>}
        </div>

        <div className="panel rounded-2xl p-5">
          <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Scale Sensitivity — large dataset (20,000 symbols)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Same compression ratio holds at scale — memory savings don&apos;t erode as the
            symbol count grows from hundreds to tens of thousands.
          </p>
          {largeRow && largeConv ? (
            <div className="flex items-end gap-6 h-32">
              <MiniBar label="Conventional" value={largeConv.memory_bytes} max={largeConv.memory_bytes} color="bg-slate-300" />
              <MiniBar label="BudgetSym" value={largeRow.memory_bytes} max={largeConv.memory_bytes} color="bg-teal-500" highlight={`${largeRow.compression_ratio.toFixed(2)}×`} />
            </div>
          ) : <div className="text-xs text-slate-400">Data unavailable.</div>}
        </div>
      </div>

      {/* Signature visual: memory savings vs latency trade-off */}
      <div className="panel rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Memory Savings vs. Lookup/Insert Overhead</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              How much memory can be saved before the latency overhead becomes unacceptable? Each
              point is one dataset&apos;s BudgetSym result.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs font-mono">
            <button onClick={() => setLatencyMetric("insert_us")}
              className={`px-2.5 py-1 rounded-md ${latencyMetric === "insert_us" ? "bg-white text-indigo-700 border border-slate-200 shadow-sm" : "text-slate-500"}`}>
              vs Insert
            </button>
            <button onClick={() => setLatencyMetric("lookup_success_us")}
              className={`px-2.5 py-1 rounded-md ${latencyMetric === "lookup_success_us" ? "bg-white text-indigo-700 border border-slate-200 shadow-sm" : "text-slate-500"}`}>
              vs Lookup
            </button>
          </div>
        </div>
        <TradeoffScatter rows={budgetRows} metric={latencyMetric} />
      </div>
    </div>
  );
}

function rowFor2(rows: BenchmarkRow[], dataset: string, impl: string): BenchmarkRow | undefined {
  return rows.find((r) => r.dataset === dataset && r.implementation === impl);
}

function MiniBar({ label, value, max, color, highlight }: { label: string; value: number; max: number; color: string; highlight?: string }) {
  const pct = max > 0 ? Math.max(6, (value / max) * 100) : 6;
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="w-full h-24 flex items-end justify-center bg-slate-50 rounded-lg border border-slate-100 relative">
        <div className={`w-10 rounded-t ${color}`} style={{ height: `${pct}%` }} />
        {highlight && <span className="absolute -top-5 text-[10px] font-mono font-bold text-teal-700">{highlight}</span>}
      </div>
      <span className="text-[10px] font-mono text-slate-500">{label}</span>
      <span className="text-[10px] font-mono text-slate-700 font-semibold">{value.toLocaleString()} B</span>
    </div>
  );
}

function TradeoffScatter({ rows, metric }: { rows: BenchmarkRow[]; metric: "insert_us" | "lookup_success_us" }) {
  const W = 640, H = 320, PAD = 48;
  if (rows.length === 0) return <div className="text-xs text-slate-400 py-12 text-center">No data.</div>;

  const xs = rows.map((r) => r.compression_ratio);
  const ys = rows.map((r) => r[metric]);
  const xMin = 1, xMax = Math.max(...xs) * 1.1;
  const yMin = 0, yMax = Math.max(...ys) * 1.15;

  const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 1.5);
  const sy = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin || 1)) * (H - PAD * 1.5);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="min-w-[520px]">
        {/* axes */}
        <line x1={PAD} y1={H - PAD} x2={W - 12} y2={H - PAD} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={PAD} y1={12} x2={PAD} y2={H - PAD} stroke="#e2e8f0" strokeWidth={1} />
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace">
          Compression Ratio vs Conventional (×) — higher is more memory saved
        </text>
        <text x={14} y={H / 2} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace"
          transform={`rotate(-90 14 ${H / 2})`}>
          {metric === "insert_us" ? "Insert latency (µs)" : "Lookup latency (µs)"}
        </text>

        {rows.map((r) => {
          const cx = sx(r.compression_ratio);
          const cy = sy(r[metric]);
          return (
            <g key={r.dataset}>
              <circle cx={cx} cy={cy} r={7} fill="#0d9488" fillOpacity={0.15} stroke="#0d9488" strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={2.5} fill="#0d9488" />
              <text x={cx} y={cy - 12} textAnchor="middle" fontSize="9.5" fill="#334155" fontFamily="monospace">
                {r.dataset}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
