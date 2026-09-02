"use client";

import React, { useState, useMemo } from "react";
import {
  runPolicySim,
  DEFAULT_CONFIG,
  CODE_PRESETS,
  DEFAULT_CODE,
  PolicyConfig,
  Representation,
} from "../lib/policy";

export function Playground() {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [selectedPreset, setSelectedPreset] = useState<string>("sensor-poll");
  const [config, setConfig] = useState<PolicyConfig>(DEFAULT_CONFIG);
  const [logFilter, setLogFilter] = useState<"all" | "insert" | "lookup" | "promote">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Run simulation reactively whenever code or config changes
  const simResult = useMemo(() => {
    return runPolicySim(code, config);
  }, [code, config]);

  const totalSymbols =
    simResult.repCounts.INLINE +
    simResult.repCounts.INTERNED +
    simResult.repCounts.COMPRESSED;

  const inlinePct = totalSymbols > 0 ? (simResult.repCounts.INLINE / totalSymbols) * 100 : 0;
  const internedPct = totalSymbols > 0 ? (simResult.repCounts.INTERNED / totalSymbols) * 100 : 0;
  const compressedPct = totalSymbols > 0 ? (simResult.repCounts.COMPRESSED / totalSymbols) * 100 : 0;

  const filteredLog = useMemo(() => {
    return simResult.log.filter((item) => {
      const matchesType = logFilter === "all" || item.event === logFilter;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.rep.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [simResult.log, logFilter, searchQuery]);

  const handlePresetSelect = (id: string) => {
    const found = CODE_PRESETS.find((p) => p.id === id);
    if (found) {
      setSelectedPreset(id);
      setCode(found.code);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 font-mono text-xs font-semibold uppercase tracking-wider">
              <span>⚡</span> Client-Side Interactive Playground
            </div>
            <h2 className="text-lg font-mono font-bold text-slate-100 mt-1">
              Live Policy Simulator & Representation Inspector
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Client-side JS port of the <code>decide()</code> and <code>maybePromote()</code> policies from <code>budget_sym.hpp</code>.
            </p>
          </div>

          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Presets:</span>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {CODE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setConfig(DEFAULT_CONFIG);
                setCode(DEFAULT_CODE);
                setSelectedPreset("sensor-poll");
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Config Sliders Drawer / Panel */}
        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>⚙️ Policy Parameters</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Budget Capacity: {config.budgetBytes} B | Hot Threshold: {config.hotThreshold} accesses
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">
                Inline Max Length: <span className="text-teal-300 font-bold">{config.inlineMaxLen}</span>
              </label>
              <input
                type="range"
                min="4"
                max="24"
                value={config.inlineMaxLen}
                onChange={(e) => setConfig({ ...config, inlineMaxLen: Number(e.target.value) })}
                className="w-full accent-teal-400 bg-slate-800 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Compress Min Length: <span className="text-amber-300 font-bold">{config.compressMinLen}</span>
              </label>
              <input
                type="range"
                min="6"
                max="24"
                value={config.compressMinLen}
                onChange={(e) => setConfig({ ...config, compressMinLen: Number(e.target.value) })}
                className="w-full accent-amber-400 bg-slate-800 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Hot Threshold: <span className="text-indigo-300 font-bold">{config.hotThreshold}</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={config.hotThreshold}
                onChange={(e) => setConfig({ ...config, hotThreshold: Number(e.target.value) })}
                className="w-full accent-indigo-400 bg-slate-800 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Prefix Min Shared: <span className="text-emerald-300 font-bold">{config.prefixMinShared}</span>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={config.prefixMinShared}
                onChange={(e) => setConfig({ ...config, prefixMinShared: Number(e.target.value) })}
                className="w-full accent-emerald-400 bg-slate-800 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Code Editor Column */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2 text-slate-200 font-semibold">
                <span>📝</span> C / C++ Source Editor
              </span>
              <span>{code.split("\n").length} lines</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full flex-1 min-h-[360px] bg-slate-950/80 font-mono text-xs text-slate-100 p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-teal-500/50 resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Right Simulation Stats Column */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 rounded-xl border border-teal-500/30 bg-teal-950/10">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Compression
              </div>
              <div className="font-mono text-2xl font-extrabold text-teal-400">
                {simResult.ratio.toFixed(2)}×
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/10">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                BudgetSym Bytes
              </div>
              <div className="font-mono text-2xl font-extrabold text-indigo-300">
                {simResult.budgetSymBytes} B
              </div>
            </div>
            <div className="glass-card p-4 rounded-xl border border-amber-500/30 bg-amber-950/10">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Promotions
              </div>
              <div className="font-mono text-2xl font-extrabold text-amber-400">
                {simResult.promotions}
              </div>
            </div>
          </div>

          {/* Representation Mix Spectrum */}
          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-semibold">
              <span>Representation Spectrum</span>
              <span className="text-slate-400 font-normal">{totalSymbols} symbols</span>
            </div>

            {/* Combined Bar */}
            <div className="h-5 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800">
              <div
                style={{ width: `${inlinePct}%` }}
                className="bg-teal-400 transition-all duration-300 relative group"
                title={`INLINE: ${simResult.repCounts.INLINE} (${inlinePct.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${internedPct}%` }}
                className="bg-indigo-500 transition-all duration-300 relative group"
                title={`INTERNED: ${simResult.repCounts.INTERNED} (${internedPct.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${compressedPct}%` }}
                className="bg-amber-400 transition-all duration-300 relative group"
                title={`COMPRESSED: ${simResult.repCounts.COMPRESSED} (${compressedPct.toFixed(1)}%)`}
              />
            </div>

            {/* Mix Legend */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-teal-400 inline-block" />
                <span>INLINE ({simResult.repCounts.INLINE})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />
                <span>INTERNED ({simResult.repCounts.INTERNED})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                <span>COMPRESSED ({simResult.repCounts.COMPRESSED})</span>
              </div>
            </div>
          </div>

          {/* Execution Log Table */}
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex-1 flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <span>📋</span> Event Execution Log ({filteredLog.length})
              </span>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-teal-500 w-28"
                />
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-teal-300 focus:outline-none"
                >
                  <option value="all">All Events</option>
                  <option value="insert">Insert</option>
                  <option value="lookup">Lookup</option>
                  <option value="promote">Promote</option>
                </select>
              </div>
            </div>

            {/* Scrollable Log Rows */}
            <div className="overflow-y-auto max-h-[220px] rounded-lg border border-slate-800/80">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <th className="py-2 px-3">Identifier</th>
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Representation</th>
                    <th className="py-2 px-3 text-right">Bytes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredLog.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500">
                        No events matched filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLog.map((ev, i) => {
                      const isInsert = ev.event === "insert";
                      const isPromote = ev.event === "promote";
                      const repClass =
                        ev.rep === "INLINE"
                          ? "bg-teal-950/60 text-teal-300 border-teal-500/30"
                          : ev.rep === "INTERNED"
                          ? "bg-indigo-950/60 text-indigo-300 border-indigo-500/30"
                          : "bg-amber-950/60 text-amber-300 border-amber-500/30";

                      return (
                        <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-1.5 px-3 font-semibold text-slate-200">
                            {ev.name}
                          </td>
                          <td className="py-1.5 px-3">
                            <span
                              className={`uppercase text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isPromote
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                                  : isInsert
                                  ? "bg-teal-500/10 text-teal-300"
                                  : "text-slate-400"
                              }`}
                            >
                              {ev.event}
                            </span>
                          </td>
                          <td className="py-1.5 px-3">
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${repClass}`}
                            >
                              {ev.rep}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-300 font-numeric">
                            {ev.bytes > 0 ? `${ev.bytes} B` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
