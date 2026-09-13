"use client";

import React, { useEffect, useState } from "react";

type CacheRow = {
  dataset: string;
  variant: "cache-off" | "cache-on";
  symbols: number;
  insert_us: number;
  cold_lookup_us: number;
  repeated_lookup_us: number;
  cache_hit_rate: number;
  speedup_vs_no_cache_x: number;
};

export function CacheBenchmarkView() {
  const [rows, setRows] = useState<CacheRow[]>([]);
  const [source, setSource] = useState<"live" | "none">("none");

  useEffect(() => {
    fetch("/api/cache-benchmark")
      .then((r) => r.json())
      .then((data) => {
        if (data.available && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows as CacheRow[]);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  const datasets = Array.from(new Set(rows.map((r) => r.dataset)));

  if (source === "none") {
    return (
      <div className="panel p-6 rounded-2xl text-sm text-slate-500">
        No cache benchmark data available. Run{" "}
        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">./cache_benchmark.exe</code>{" "}
        from the repo root to generate <code className="font-mono text-xs">results/cache_benchmark_results.csv</code>.
      </div>
    );
  }

  return (
    <div className="panel p-6 rounded-2xl space-y-5">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h3 className="font-mono text-base font-semibold text-slate-900">
            LRU Lookup Cache: On vs. Off
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Cold (cache cannot help, shows bookkeeping overhead) vs. repeated
            hot-subset lookup (what the cache targets) — see docs/caching.md
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border bg-teal-50 text-teal-700 border-teal-200">
          live
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 text-left font-semibold">Dataset</th>
              <th className="py-3 px-4 text-left font-semibold">Cache</th>
              <th className="py-3 px-4 text-right font-semibold">Cold (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Repeated (µs)</th>
              <th className="py-3 px-4 text-right font-semibold">Hit rate</th>
              <th className="py-3 px-4 text-right font-semibold">Speedup (repeated)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {datasets.map((ds) => {
              const off = rows.find((r) => r.dataset === ds && r.variant === "cache-off");
              const on = rows.find((r) => r.dataset === ds && r.variant === "cache-on");
              if (!off || !on) return null;
              const isWin = on.speedup_vs_no_cache_x >= 1.05;
              const isLoss = on.speedup_vs_no_cache_x <= 0.95;
              return (
                <React.Fragment key={ds}>
                  <tr className="text-slate-700">
                    <td rowSpan={2} className="py-3 px-4 align-top font-semibold text-slate-900">{ds}</td>
                    <td className="py-2 px-4 text-slate-500">off</td>
                    <td className="py-2 px-4 text-right font-numeric">{off.cold_lookup_us.toFixed(3)}</td>
                    <td className="py-2 px-4 text-right font-numeric">{off.repeated_lookup_us.toFixed(3)}</td>
                    <td className="py-2 px-4 text-right font-numeric text-slate-400">—</td>
                    <td rowSpan={2} className={`py-2 px-4 text-right align-middle font-bold ${isWin ? "text-teal-700" : isLoss ? "text-amber-700" : "text-slate-500"}`}>
                      {on.speedup_vs_no_cache_x.toFixed(2)}×{isWin ? " faster" : isLoss ? " slower" : ""}
                    </td>
                  </tr>
                  <tr className="bg-teal-50/40 text-slate-900 font-semibold">
                    <td className="py-2 px-4 text-teal-700">on</td>
                    <td className="py-2 px-4 text-right font-numeric">{on.cold_lookup_us.toFixed(3)}</td>
                    <td className="py-2 px-4 text-right font-numeric">{on.repeated_lookup_us.toFixed(3)}</td>
                    <td className="py-2 px-4 text-right font-numeric">{(on.cache_hit_rate * 100).toFixed(0)}%</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <span className="text-base leading-none">⚖</span>
        <div>
          <strong className="font-mono text-amber-800 block mb-0.5">Conditional, not universal:</strong>
          The cache wins substantially on compression-heavy datasets where
          reconstruction is expensive, and loses on datasets that mostly use
          cheap representations already (cache bookkeeping costs more than
          the near-free reconstruction it replaces). Single-run numbers on a
          shared machine — see docs/caching.md for the full caveat.
        </div>
      </div>
    </div>
  );
}
