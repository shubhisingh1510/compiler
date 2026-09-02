"use client";

import React from "react";

export function KpiGrid() {
  const kpis = [
    {
      title: "Peak Compression Ratio",
      value: "2.37×",
      subtitle: "high-prefix-similarity dataset",
      badge: "Best Case",
      accent: "text-teal-400",
      border: "border-teal-500/30",
      bg: "bg-teal-950/20",
      icon: "⚡",
    },
    {
      title: "Worst-Case Compression",
      value: "1.24×",
      subtitle: "random-identifiers dataset",
      badge: "Floor Bound",
      accent: "text-indigo-400",
      border: "border-indigo-500/30",
      bg: "bg-indigo-950/20",
      icon: "🛡️",
    },
    {
      title: "Interning Baseline",
      value: "1.05–1.07×",
      subtitle: "Outperformed across all 8 datasets",
      badge: "Baseline Beaten",
      accent: "text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20",
      icon: "📈",
    },
    {
      title: "Insert Cost (Large)",
      value: "2.76×",
      subtitle: "Slower than Conventional (20k dataset)",
      badge: "Latency Trade-off",
      accent: "text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-950/20",
      icon: "⚖️",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          className={`glass-panel p-5 rounded-2xl border ${kpi.border} ${kpi.bg} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl relative overflow-hidden group`}
        >
          {/* Accent glow line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
              {kpi.title}
            </span>
            <span className="text-lg">{kpi.icon}</span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`font-mono text-3xl font-extrabold tracking-tight ${kpi.accent}`}>
              {kpi.value}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              {kpi.badge}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            {kpi.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
