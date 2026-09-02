"use client";

import React from "react";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

const representations = [
  {
    name: "INLINE",
    tone: "teal" as const,
    desc: "Short identifiers stored directly on the entry under low memory pressure.",
    overhead: "~28 bytes fixed overhead + string length",
    useCase: "Loop counters (i, idx, count), short temporary variables.",
  },
  {
    name: "INTERNED",
    tone: "indigo" as const,
    desc: "Exact-repeat identifiers, or the balanced default, reference a single shared string-pool entry.",
    overhead: "~28 bytes index overhead + shared pool entry (paid once per unique string)",
    useCase: "Repeated identifiers, and anything that doesn't clearly favor INLINE or COMPRESSED.",
  },
  {
    name: "COMPRESSED",
    tone: "amber" as const,
    desc: "Prefix-similar identifiers (e.g. sensorReading1, sensorReading2) store a front-coding delta relative to the previous COMPRESSED entry.",
    overhead: "~29 bytes link overhead + 1 byte shared-prefix length + suffix characters",
    useCase: "Runs of related, long, prefix-similar declarations (HAL/peripheral driver style naming).",
  },
];

const toneClasses = {
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

export function ArchitectureDocs() {
  return (
    <div className="space-y-8">
      <div className="panel p-6 rounded-2xl space-y-2">
        <h2 className="text-lg font-bold text-slate-900">System Architecture</h2>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          BUDGET-SYM targets memory-bounded embedded compilation environments where symbol-table
          RAM footprint must stay strictly bounded. Click any component below to read what it does.
        </p>
      </div>

      <ArchitectureDiagram />

      {/* 3 Storage Representations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {representations.map((rep) => (
          <div key={rep.name} className={`panel rounded-2xl p-5 space-y-3 border ${toneClasses[rep.tone]}`}>
            <span className="font-mono text-sm font-extrabold tracking-wider">● {rep.name}</span>
            <p className="text-xs text-slate-700 leading-relaxed">{rep.desc}</p>
            <div className="space-y-1.5 pt-2 border-t border-white/60 text-[11px] font-mono text-slate-600">
              <div><strong className="text-slate-800">Overhead:</strong> {rep.overhead}</div>
              <div><strong className="text-slate-800">Typical use:</strong> {rep.useCase}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Decision Flow Diagram -- exact branch order from include/budget_sym.hpp::decide() */}
      <div className="panel p-6 rounded-2xl space-y-4">
        <h3 className="font-mono text-sm font-bold text-slate-900">
          Policy Decision Logic — decide()
        </h3>
        <p className="text-xs text-slate-500">
          Exact branch order from <code className="bg-slate-100 px-1 rounded">include/budget_sym.hpp</code>, checked top to bottom; the first matching rule wins.
        </p>

        <div className="panel-soft p-4 rounded-xl font-mono text-xs text-slate-700 space-y-2 leading-relaxed overflow-x-auto">
          <div className="text-slate-400">{"// 0. Ablation escape hatch"}</div>
          <div>IF disableAdaptiveSelection: <span className="pl-2 text-indigo-700">RETURN fixedRepresentation</span></div>

          <div className="text-slate-400 pt-2">{"// 1. Exact repeat"}</div>
          <div>IF this exact identifier was already inserted before:</div>
          <div className="pl-4 text-indigo-700">⇒ INTERNED (share the existing pool entry)</div>

          <div className="text-slate-400 pt-2">{"// 2. Memory pressure override"}</div>
          <div>ELSE IF pressure ≥ HIGH_PRESSURE (85%) AND len(name) ≥ COMPRESS_MIN_LEN AND NOT hot:</div>
          <div className="pl-4 text-amber-700">⇒ COMPRESSED</div>

          <div className="text-slate-400 pt-2">{"// 3. Opportunistic prefix compression"}</div>
          <div>ELSE IF len(name) ≥ COMPRESS_MIN_LEN AND sharedPrefix(prev, name) ≥ MIN_SHARED AND NOT hot:</div>
          <div className="pl-4 text-amber-700">⇒ COMPRESSED</div>

          <div className="text-slate-400 pt-2">{"// 4. Cheap path for short identifiers under low pressure"}</div>
          <div>ELSE IF len(name) &lt; INLINE_MAX_LEN AND pressure &lt; LOW_PRESSURE (50%):</div>
          <div className="pl-4 text-teal-700">⇒ INLINE</div>

          <div className="text-slate-400 pt-2">{"// 5. Default fallback"}</div>
          <div>ELSE:</div>
          <div className="pl-4 text-indigo-700">⇒ INTERNED</div>
        </div>

        <p className="text-[11px] text-slate-400">
          &quot;hot&quot; means accessFreqHint ≥ hotAccessThreshold at insert time. Independently, any
          COMPRESSED entry can be <strong>promoted</strong> to INTERNED later, once its real runtime
          access count crosses hotAccessThreshold — see <code className="bg-slate-100 px-1 rounded">maybePromote()</code>.
        </p>
      </div>
    </div>
  );
}
