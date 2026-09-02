"use client";

import React, { useEffect, useState } from "react";
import { benchmarkRows as fallbackRows, BenchmarkRow } from "../lib/benchmark-data";

interface Kpi {
  title: string;
  value: string;
  subtitle: string;
  badge: string;
  accent: string;
  border: string;
  bg: string;
}

function computeKpis(rows: BenchmarkRow[]): Kpi[] {
  const budget = rows.filter((r) => r.implementation === "BudgetSym");
  const interned = rows.filter((r) => r.implementation === "Interned");
  const best = budget.reduce((a, b) => (b.compression_ratio > a.compression_ratio ? b : a), budget[0]);
  const worst = budget.reduce((a, b) => (b.compression_ratio < a.compression_ratio ? b : a), budget[0]);
  const internedMin = Math.min(...interned.map((r) => r.compression_ratio));
  const internedMax = Math.max(...interned.map((r) => r.compression_ratio));
  const largeBudget = rows.find((r) => r.dataset === "large" && r.implementation === "BudgetSym");
  const largeConv = rows.find((r) => r.dataset === "large" && r.implementation === "Conventional");
  const insertRatio = largeBudget && largeConv ? largeBudget.insert_us / largeConv.insert_us : null;

  return [
    {
      title: "Peak Compression Ratio",
      value: `${best.compression_ratio.toFixed(2)}×`,
      subtitle: `${best.dataset} dataset`,
      badge: "Best Case",
      accent: "text-teal-700", border: "border-teal-200", bg: "bg-teal-50",
    },
    {
      title: "Worst-Case Compression",
      value: `${worst.compression_ratio.toFixed(2)}×`,
      subtitle: `${worst.dataset} dataset`,
      badge: "Floor Bound",
      accent: "text-indigo-700", border: "border-indigo-200", bg: "bg-indigo-50",
    },
    {
      title: "Interning Baseline",
      value: `${internedMin.toFixed(2)}–${internedMax.toFixed(2)}×`,
      subtitle: "Outperformed across every dataset",
      badge: "Baseline Beaten",
      accent: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50",
    },
    {
      title: "Insert Cost (large)",
      value: insertRatio ? `${insertRatio.toFixed(2)}×` : "—",
      subtitle: "Slower than Conventional (20k dataset)",
      badge: "Latency Trade-off",
      accent: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50",
    },
  ];
}

export function KpiGrid() {
  const [kpis, setKpis] = useState<Kpi[]>(() => computeKpis(fallbackRows));
  const [source, setSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    fetch("/api/benchmarks")
      .then((r) => r.json())
      .then((data) => {
        if (data.available && Array.isArray(data.rows) && data.rows.length > 0) {
          setKpis(computeKpis(data.rows));
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${source === "live" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
          {source === "live" ? "computed from results/benchmark_results.csv" : "bundled snapshot"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className={`panel card-hover p-5 rounded-2xl border ${kpi.border} relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 right-0 h-1 ${kpi.bg}`} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider">
                {kpi.title}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
              <span className={`font-mono text-3xl font-extrabold tracking-tight ${kpi.accent}`}>
                {kpi.value}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                {kpi.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{kpi.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
