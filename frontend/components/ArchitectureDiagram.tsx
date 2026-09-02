"use client";

import React, { useState } from "react";

const COMPONENTS: Record<string, { title: string; body: string }> = {
  source: { title: "Source Code → Identifier Extraction", body: "The lightweight heuristic extractor (frontend/lib/extract.ts) turns source text into a scope/declaration event stream. It recognizes brace-delimited scopes and \"TYPE NAME\" declarations — it is explicitly not a full C/C++ parser." },
  controller: { title: "BUDGET-SYM Controller", body: "include/budget_sym.hpp's BudgetSym class. Receives the event stream (via src/analyze_main.cpp) and orchestrates the three signal collectors below plus the decision policy." },
  memory: { title: "Memory Monitor", body: "MemoryTracker (include/memory_tracker.hpp) — tracks a documented, deterministic \"Tracked Memory\" cost model against the configured budget, and reports pressure = current / budget." },
  scope: { title: "Scope / Lifetime Analyzer", body: "The per-scope hash index plus the scope stack. enterScope()/exitScope() bound each symbol's lifetime and reclaim its memory when its scope closes." },
  access: { title: "Access Profiler", body: "Per-symbol accessCount, incremented on every lookup(). Feeds the promotion mechanic: a COMPRESSED entry crossing hotAccessThreshold accesses gets promoted to INTERNED." },
  policy: { title: "Adaptive Representation Policy (decide())", body: "Combines exact-repeat status, memory pressure, prefix similarity to the previous declaration, and the access-frequency hint into one representation choice — see the exact branch order below." },
  inline: { title: "INLINE", body: "Short identifier stored directly on the entry. Cheapest lookup, no sharing, no pool indirection." },
  interned: { title: "INTERNED", body: "Index into a shared, refcounted string pool. Used for exact repeats and as the balanced default fallback." },
  compressed: { title: "COMPRESSED", body: "Front-coded (prefix-shared) against the previous COMPRESSED identifier, re-anchored every reanchorInterval inserts to bound decode-chain depth." },
  index: { title: "Compact Index", body: "Each scope maps fnv1a(name) → entry id, not the string itself — otherwise every representation would still pay for a full string in the lookup key, defeating compression entirely." },
  lookup: { title: "Lookup / Insert / Scope Management", body: "The three public operations user code (or the web dashboard) actually calls: insert(), lookup(), enterScope()/exitScope()." },
};

const NODE_ORDER = ["source", "controller", "memory", "scope", "access", "policy", "inline", "interned", "compressed", "index", "lookup"];

export function ArchitectureDiagram() {
  const [selected, setSelected] = useState<string>("policy");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 panel rounded-2xl p-6">
        <svg viewBox="0 0 700 480" width="100%" height="440">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
          <Box id="source" x={230} y={10} w={240} h={36} selected={selected} onSelect={setSelected} label="Source Code → Extraction" />
          <Arrow x1={350} y1={46} x2={350} y2={68} />
          <Box id="controller" x={230} y={70} w={240} h={36} selected={selected} onSelect={setSelected} label="BUDGET-SYM Controller" accent />
          <Arrow x1={350} y1={106} x2={350} y2={126} />

          <Box id="memory" x={30} y={128} w={200} h={44} selected={selected} onSelect={setSelected} label="Memory Monitor" sub="budget, current, pressure" />
          <Box id="scope" x={250} y={128} w={200} h={44} selected={selected} onSelect={setSelected} label="Scope / Lifetime Analyzer" sub="enter/exit, reclamation" />
          <Box id="access" x={470} y={128} w={200} h={44} selected={selected} onSelect={setSelected} label="Access Profiler" sub="per-symbol accessCount" />
          <Arrow x1={130} y1={172} x2={330} y2={196} />
          <Arrow x1={350} y1={172} x2={350} y2={196} />
          <Arrow x1={570} y1={172} x2={370} y2={196} />

          <Box id="policy" x={220} y={198} w={260} h={38} selected={selected} onSelect={setSelected} label="Adaptive Representation Policy" accent />
          <Arrow x1={350} y1={236} x2={350} y2={256} />

          <Box id="inline" x={130} y={258} w={120} h={36} selected={selected} onSelect={setSelected} label="INLINE" tone="teal" />
          <Box id="interned" x={290} y={258} w={120} h={36} selected={selected} onSelect={setSelected} label="INTERNED" tone="indigo" />
          <Box id="compressed" x={450} y={258} w={130} h={36} selected={selected} onSelect={setSelected} label="COMPRESSED" tone="amber" />
          <path d="M480,294 C 440,320 400,332 370,306" fill="none" stroke="#f59e0b" strokeWidth={1.4} strokeDasharray="4,3" markerEnd="url(#arrow)" />
          <text x={430} y={332} fontSize="9" fill="#b45309" fontFamily="monospace">promote when hot</text>

          <Arrow x1={190} y1={294} x2={330} y2={356} />
          <Arrow x1={350} y1={294} x2={350} y2={356} />
          <Arrow x1={510} y1={294} x2={370} y2={356} />

          <Box id="index" x={230} y={358} w={240} h={36} selected={selected} onSelect={setSelected} label="Compact Index" />
          <Arrow x1={350} y1={394} x2={350} y2={414} />
          <Box id="lookup" x={190} y={416} w={320} h={40} selected={selected} onSelect={setSelected} label="Lookup / Insert / Scope Management" accent />
        </svg>
      </div>

      <div className="lg:col-span-4">
        <div className="panel rounded-2xl p-5 sticky top-24 space-y-3">
          <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Component</h3>
          <div className="text-sm font-bold text-slate-900">{COMPONENTS[selected]?.title}</div>
          <p className="text-xs text-slate-600 leading-relaxed">{COMPONENTS[selected]?.body}</p>
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
            {NODE_ORDER.map((id) => (
              <button key={id} onClick={() => setSelected(id)}
                className={`text-[10px] font-mono px-2 py-1 rounded ${selected === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ id, x, y, w, h, label, sub, selected, onSelect, accent, tone }: {
  id: string; x: number; y: number; w: number; h: number; label: string; sub?: string;
  selected: string; onSelect: (id: string) => void; accent?: boolean; tone?: "teal" | "indigo" | "amber";
}) {
  const isSelected = selected === id;
  const fill = tone === "teal" ? "#f0fdfa" : tone === "indigo" ? "#eef2ff" : tone === "amber" ? "#fffbeb" : accent ? "#eef2ff" : "#f8fafc";
  const stroke = isSelected ? "#4f46e5" : tone === "teal" ? "#5eead4" : tone === "indigo" ? "#a5b4fc" : tone === "amber" ? "#fcd34d" : "#cbd5e1";
  const textColor = tone === "teal" ? "#0f766e" : tone === "indigo" ? "#4338ca" : tone === "amber" ? "#b45309" : "#1e293b";
  return (
    <g onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.2} />
      <text x={x + w / 2} y={sub ? y + h / 2 - 3 : y + h / 2 + 4} textAnchor="middle" fontSize="11" fontFamily="monospace" fill={textColor} fontWeight={600}>
        {label}
      </text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#64748b">{sub}</text>}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.3} markerEnd="url(#arrow)" />;
}
