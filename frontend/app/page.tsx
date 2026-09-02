"use client";

import React, { useState } from "react";
import { Navbar, TabType } from "../components/Navbar";
import { KpiGrid } from "../components/KpiGrid";
import { BenchmarkCharts } from "../components/BenchmarkCharts";
import { LatencyTable } from "../components/LatencyTable";
import { AblationView } from "../components/AblationView";
import { Playground } from "../components/Playground";
import { ArchitectureDocs } from "../components/ArchitectureDocs";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Header & Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* KPI Grid on top for quick scanning */}
        <KpiGrid />

        {/* Dynamic Tab Views */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <BenchmarkCharts />
            <LatencyTable />
          </div>
        )}

        {activeTab === "ablation" && (
          <div className="animate-in fade-in duration-300">
            <AblationView />
          </div>
        )}

        {activeTab === "playground" && (
          <div className="animate-in fade-in duration-300">
            <Playground />
          </div>
        )}

        {activeTab === "docs" && (
          <div className="animate-in fade-in duration-300">
            <ArchitectureDocs />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 text-slate-500 py-6 px-4 text-center font-mono text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            BUDGET-SYM // Adaptive Symbol Table Compiler Research Project
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Generated from results/*.csv</span>
            <span>•</span>
            <span>C++14 Prototype</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
