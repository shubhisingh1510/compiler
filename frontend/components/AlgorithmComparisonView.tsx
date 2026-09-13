"use client";

import React, { useEffect, useState } from "react";

type AlgoRow = {
  dataset: string;
  algorithm: string;
  symbols: number;
  memory_bytes: number;
  memory_per_symbol: number;
  compression_ratio: number;
  slack_bytes: number;
  insert_us: number;
  lookup_success_us: number;
  lookup_failure_us: number;
};

const ALGO_ORDER = ["BudgetSym-FNV1a", "BudgetSym-Murmur3", "BudgetSym-DJB2", "RobinHood", "Trie"];
const ALGO_DOT: Record<string, string> = {
  "BudgetSym-FNV1a": "bg-teal-500",
  "BudgetSym-Murmur3": "bg-teal-700",
  "BudgetSym-DJB2": "bg-emerald-400",
  RobinHood: "bg-indigo-500",
  Trie: "bg-amber-500",
};

export function AlgorithmComparisonView() {
  const [rows, setRows] = useState<AlgoRow[]>([]);
  const [source, setSource] = useState<"live" | "none">("none");
  const [selectedDataset, setSelectedDataset] = useState<string>("high-prefix-similarity");

  useEffect(() => {
    fetch("/api/algorithm-comparison")
      .then((r) => r.json())
      .then((data) => {
        if (data.available && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows as AlgoRow[]);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  const datasets = Array.from(new Set(rows.map((r) => r.dataset)));

  if (source === "none") {
    return (
      <div className="panel p-6 rounded-2xl text-sm text-slate-500">
        No algorithm comparison data available. Run{" "}
        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">./algorithm_benchmark.exe</code>{" "}
        from the repo root to generate <code className="font-mono text-xs">results/algorithm_comparison.csv</code>.
      </div>
    );
  }

  const filteredRows = rows
    .filter((r) => r.dataset === selectedDataset)
    .sort((a, b) => ALGO_ORDER.indexOf(a.algorithm) - ALGO_ORDER.indexOf(b.algorithm));

  const bestCompression = Math.max(...filteredRows.map((r) => r.compression_ratio));
  const bestLookup = Math.min(...filteredRows.filter((r) => r.lookup_success_us > 0).map((r) => r.lookup_success_us));

  return (
    <div className="panel p-6 rounded-2xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h3 className="font-mono text-base font-semibold text-slate-900">
            Algorithm Comparison: Hashing &amp; Storage Backends
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            5 algorithms on the same dataset — see docs/algorithm_comparison.md
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border bg-teal-50 text-teal-700 border-teal-200">
            live
          </span>
          <label className="text-xs font-mono text-slate-500">Dataset:</label>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
          >
            {datasets.map((ds) => (
              <option key={ds} value={ds}>{ds}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 text-left font-semibold">Algorithm</th>
              <th className="py-3 px-4 text-right font-semibold">Memory/Sym</th>
              <th className="py-3 px-4 text-right font-semibold">Ratio</th>
              <th className="py-3 px-4 text-right font-semibold">Slack bytes</th>
              <th className="py-3 px-4 text-right font-semibold text-amber-700">Insert (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Lookup hit (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Lookup miss (µs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((r) => {
              const isBestCompression = r.compression_ratio === bestCompression;
              const isBestLookup = r.lookup_success_us === bestLookup;
              return (
                <tr key={r.algorithm} className="hover:bg-slate-50 text-slate-700 transition-colors">
                  <td className="py-3 px-4 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ALGO_DOT[r.algorithm] ?? "bg-slate-400"}`} />
                    {r.algorithm}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">{r.memory_per_symbol.toFixed(1)} B</td>
                  <td className={`py-3 px-4 text-right font-numeric font-bold ${isBestCompression ? "text-teal-700" : "text-slate-700"}`}>
                    {r.compression_ratio.toFixed(2)}×{isBestCompression ? " ★" : ""}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric text-slate-500">
                    {r.slack_bytes > 0 ? r.slack_bytes.toLocaleString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric text-amber-700">{r.insert_us.toFixed(3)}</td>
                  <td className={`py-3 px-4 text-right font-numeric font-bold ${isBestLookup ? "text-indigo-700" : "text-slate-700"}`}>
                    {r.lookup_success_us.toFixed(4)}{isBestLookup ? " ★" : ""}
                  </td>
                  <td className="py-3 px-4 text-right font-numeric">{r.lookup_failure_us.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <span className="text-base leading-none">⚖</span>
        <div>
          <strong className="font-mono text-amber-800 block mb-0.5">No algorithm wins both:</strong>
          RobinHood (★ lookup) wins latency on every dataset by avoiding
          reconstruction entirely, at a real memory cost (Slack bytes —
          preallocated-but-empty open-addressing slots, not counted in its
          own Ratio column). BudgetSym (★ ratio) wins compression on every
          dataset by paying that reconstruction cost. Trie never wins
          either metric outright but rejects absent identifiers fastest.
        </div>
      </div>
    </div>
  );
}
