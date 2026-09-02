"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAnalysis, AnalyzedSymbol } from "../lib/AnalysisContext";
import { RepBadge } from "./Playground";

type SortKey = "id" | "name" | "scopeId" | "representation";

export function SymbolTableExplorer() {
  const { result, loading, error } = useAnalysis();
  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState<"ALL" | "INLINE" | "INTERNED" | "COMPRESSED">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [selected, setSelected] = useState<AnalyzedSymbol | null>(null);

  const symbols = useMemo(() => result?.symbols ?? [], [result]);

  const filtered = useMemo(() => {
    let rows = symbols;
    if (repFilter !== "ALL") rows = rows.filter((s) => s.representation === repFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((s) => s.name.toLowerCase().includes(q) || s.typeHint.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "scopeId") return a.scopeId - b.scopeId;
      if (sortKey === "representation") return a.representation.localeCompare(b.representation);
      return a.id - b.id;
    });
  }, [symbols, query, repFilter, sortKey]);

  if (loading) {
    return <EmptyState title="Compiling…" body="Waiting on the real analyze.exe engine." />;
  }

  if (error) {
    return <EmptyState title="Backend unavailable" body={error} tone="error" />;
  }

  if (!result || symbols.length === 0) {
    return (
      <EmptyState
        title="No symbols yet"
        body="Go to the Compiler page, enter or pick a source snippet, and click Compile / Analyze. The real result will show up here."
        action={<Link href="/compiler" className="text-indigo-600 text-xs font-semibold hover:underline">Open Compiler →</Link>}
      />
    );
  }

  const counts = { INLINE: 0, INTERNED: 0, COMPRESSED: 0 } as Record<string, number>;
  for (const s of symbols) counts[s.representation]++;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-4">
        {/* Controls */}
        <div className="panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search identifier or type…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
          />
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value as typeof repFilter)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-700">
            <option value="ALL">All representations</option>
            <option value="INLINE">INLINE ({counts.INLINE})</option>
            <option value="INTERNED">INTERNED ({counts.INTERNED})</option>
            <option value="COMPRESSED">COMPRESSED ({counts.COMPRESSED})</option>
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-700">
            <option value="id">Sort: Declaration order</option>
            <option value="name">Sort: Name</option>
            <option value="scopeId">Sort: Scope</option>
            <option value="representation">Sort: Representation</option>
          </select>
        </div>

        {/* Table */}
        <div className="panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4">Identifier</th>
                  <th className="py-2.5 px-4">ID</th>
                  <th className="py-2.5 px-4">Scope</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Representation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={`cursor-pointer transition-colors ${selected?.id === s.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="py-2 px-4 font-semibold text-slate-800">{s.name}</td>
                    <td className="py-2 px-4 text-slate-400">#{s.id}</td>
                    <td className="py-2 px-4 text-slate-500">scope {s.scopeId}</td>
                    <td className="py-2 px-4 text-slate-500">{s.typeHint}</td>
                    <td className="py-2 px-4"><RepBadge rep={s.representation} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">No symbols match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div className="lg:col-span-4">
        <div className="panel rounded-2xl p-5 sticky top-24 space-y-4">
          <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">Symbol Detail</h3>
          {!selected ? (
            <p className="text-xs text-slate-400">Click a row to inspect its representation, memory cost, and the real reason the policy chose it.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-lg font-mono font-bold text-slate-900">{selected.name}</div>
              <RepBadge rep={selected.representation} />
              <dl className="text-xs space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between"><dt className="text-slate-400">Scope</dt><dd className="text-slate-700">scope {selected.scopeId}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Type hint</dt><dd className="text-slate-700">{selected.typeHint}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Declaration order</dt><dd className="text-slate-700">#{selected.id}</dd></div>
              </dl>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Reason for representation</div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {selected.reason}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body, tone = "neutral", action }: { title: string; body: string; tone?: "neutral" | "error"; action?: React.ReactNode }) {
  return (
    <div className={`panel rounded-2xl p-10 text-center space-y-2 ${tone === "error" ? "border-red-200" : ""}`}>
      <h3 className={`text-sm font-semibold ${tone === "error" ? "text-red-700" : "text-slate-700"}`}>{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{body}</p>
      {action}
    </div>
  );
}
