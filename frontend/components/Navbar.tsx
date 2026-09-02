"use client";

import React from "react";

export type TabType = "dashboard" | "ablation" | "playground" | "docs";

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "dashboard", label: "Benchmark Metrics", icon: "📊" },
    { id: "ablation", label: "Ablation Study", icon: "🔬" },
    { id: "playground", label: "Live Simulator", icon: "⚡" },
    { id: "docs", label: "Architecture & Theory", icon: "📚" },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 lg:px-8 py-3.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 via-indigo-500 to-amber-400 p-[1px] shadow-lg glow-teal">
            <div className="h-full w-full bg-slate-950 rounded-[11px] flex items-center justify-center font-mono font-bold text-teal-400 text-lg">
              BS
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-extrabold text-lg text-slate-100 tracking-tight">
                BUDGET-SYM
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                v1.0 Adaptive
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Scope-Aware Symbol Table for Memory-Bounded Embedded Compilation
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-slate-800 text-teal-300 font-semibold shadow-md border border-slate-700/80"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Representation Badges */}
        <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-md bg-teal-950/60 border border-teal-500/30 text-teal-300">
            ● INLINE
          </span>
          <span className="px-2.5 py-1 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            ● INTERNED
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300">
            ● COMPRESSED
          </span>
        </div>
      </div>
    </header>
  );
}
