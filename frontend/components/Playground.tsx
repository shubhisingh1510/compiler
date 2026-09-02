"use client";

import React, { useState, useMemo } from "react";
import {
  runPolicySim,
  DEFAULT_CONFIG,
  CODE_PRESETS,
  DEFAULT_CODE,
  PolicyConfig,
} from "../lib/policy";
import { useAnalysis } from "../lib/AnalysisContext";

export function Playground() {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [selectedPreset, setSelectedPreset] = useState<string>("sensor-poll");
  const [config, setConfig] = useState<PolicyConfig>(DEFAULT_CONFIG);

  const { result, loading, error, run } = useAnalysis();

  // Instant client-side preview -- recomputed on every keystroke. Clearly a
  // separate, labeled JS port (lib/policy.ts), not the real backend.
  const preview = useMemo(() => runPolicySim(code, config), [code, config]);

  const handlePresetSelect = (id: string) => {
    const found = CODE_PRESETS.find((p) => p.id === id);
    if (found) {
      setSelectedPreset(id);
      setCode(found.code);
    }
  };

  const handleCompile = () => {
    run(code, config.budgetBytes, {
      inlineMaxLen: config.inlineMaxLen,
      compressMinLen: config.compressMinLen,
      hotAccessThreshold: config.hotThreshold,
      highPressureThreshold: config.highPressure,
      lowPressureThreshold: config.lowPressure,
      prefixSimilarityMinShared: config.prefixMinShared,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-mono text-xs font-semibold uppercase tracking-wider">
              Compiler Playground
            </div>
            <h2 className="text-lg font-mono font-bold text-slate-900 mt-1">
              Source → Real BudgetSym Engine
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              A lightweight heuristic extractor (not a full C/C++ parser) finds declarations and
              brace scopes in your source, then the actual C++ <code className="text-[11px] bg-slate-100 px-1 rounded">BudgetSym</code> engine
              (<code className="text-[11px] bg-slate-100 px-1 rounded">src/analyze_main.cpp</code>) runs on them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-indigo-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              {CODE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <button
              onClick={() => { setConfig(DEFAULT_CONFIG); setCode(DEFAULT_CODE); setSelectedPreset("sensor-poll"); }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-mono text-slate-600 border border-slate-300 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleCompile}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-xs font-mono font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              {loading ? "Compiling…" : "Compile / Analyze"}
            </button>
          </div>
        </div>

        {/* Config Sliders */}
        <div className="panel-soft p-4 rounded-xl space-y-3">
          <div className="text-xs font-mono text-slate-600 font-semibold uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
            <span>Policy Parameters</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Budget: {config.budgetBytes} B · Hot Threshold: {config.hotThreshold} accesses
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
            <Slider label="Budget Bytes" value={config.budgetBytes} min={256} max={8192} step={256} accent="text-slate-700"
              onChange={(v) => setConfig({ ...config, budgetBytes: v })} />
            <Slider label="Inline Max Length" value={config.inlineMaxLen} min={4} max={24} accent="text-teal-700"
              onChange={(v) => setConfig({ ...config, inlineMaxLen: v })} />
            <Slider label="Compress Min Length" value={config.compressMinLen} min={6} max={24} accent="text-amber-700"
              onChange={(v) => setConfig({ ...config, compressMinLen: v })} />
            <Slider label="Hot Threshold" value={config.hotThreshold} min={1} max={10} accent="text-indigo-700"
              onChange={(v) => setConfig({ ...config, hotThreshold: v })} />
            <Slider label="Prefix Min Shared" value={config.prefixMinShared} min={2} max={10} accent="text-emerald-700"
              onChange={(v) => setConfig({ ...config, prefixMinShared: v })} />
          </div>
        </div>
      </div>

      {/* Editor & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Code Editor Column */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="panel p-4 rounded-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 text-xs font-mono text-slate-500">
              <span className="font-semibold text-slate-700">C / C++ Source Editor</span>
              <span>{code.split("\n").length} lines</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full flex-1 min-h-[360px] bg-slate-50 font-mono text-xs text-slate-800 p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-300 resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Right column: instant preview + real backend result */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          {/* Instant client preview */}
          <div className="panel-soft p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 font-semibold">Instant Client-Side Preview</span>
              <span className="text-slate-400">recomputed as you type · JS port of decide()</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-600">Ratio: <strong className="text-teal-700">{preview.ratio.toFixed(2)}×</strong></span>
              <span className="text-slate-600">Bytes: <strong>{preview.budgetSymBytes} B</strong></span>
              <span className="text-slate-600">Promotions: <strong className="text-amber-700">{preview.promotions}</strong></span>
            </div>
          </div>

          {/* Real backend result */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
              <strong className="font-mono block mb-1">Backend unavailable</strong>
              {error}
            </div>
          )}

          {!error && !result && !loading && (
            <div className="panel-soft rounded-xl p-6 text-center text-xs text-slate-400">
              Click &quot;Compile / Analyze&quot; to run this source through the real C++ engine.
            </div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Compression" value={`${result.compressionRatio.toFixed(2)}×`} accent="text-teal-700" bg="bg-teal-50" border="border-teal-200" />
                <Kpi label="Tracked Bytes" value={`${result.trackedMemoryBytes} B`} accent="text-indigo-700" bg="bg-indigo-50" border="border-indigo-200" />
                <Kpi label="Promotions" value={String(result.promotions)} accent="text-amber-700" bg="bg-amber-50" border="border-amber-200" />
              </div>

              {result.extractionWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
                  {result.extractionWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}

              <div className="panel rounded-xl p-4 flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-mono">
                  <span className="text-slate-700 font-semibold">Symbols ({result.symbols.length})</span>
                  <span className="text-slate-400">from the real engine — see Symbol Table page for full detail</span>
                </div>
                <div className="overflow-y-auto max-h-[240px] rounded-lg border border-slate-100">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-3">Identifier</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Representation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.symbols.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-semibold text-slate-800">{s.name}</td>
                          <td className="py-1.5 px-3 text-slate-500">{s.typeHint}</td>
                          <td className="py-1.5 px-3">
                            <RepBadge rep={s.representation} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, accent, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; accent: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-slate-500 block mb-1">
        {label}: <span className={`${accent} font-bold`}>{value}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-indigo-500" />
    </div>
  );
}

function Kpi({ label, value, accent, bg, border }: { label: string; value: string; accent: string; bg: string; border: string }) {
  return (
    <div className={`panel p-4 rounded-xl ${bg} ${border}`}>
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-2xl font-extrabold ${accent}`}>{value}</div>
    </div>
  );
}

export function RepBadge({ rep }: { rep: "INLINE" | "INTERNED" | "COMPRESSED" }) {
  const styles = {
    INLINE: "bg-teal-50 text-teal-700 border-teal-200",
    INTERNED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPRESSED: "bg-amber-50 text-amber-700 border-amber-200",
  }[rep];
  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold ${styles}`}>{rep}</span>;
}
