"use client";

import React from "react";
import Link from "next/link";
import { useAnalysis, AnalyzedScope } from "../lib/AnalysisContext";

function buildTree(scopes: AnalyzedScope[]) {
  const byParent = new Map<number, AnalyzedScope[]>();
  for (const s of scopes) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  return byParent;
}

function ScopeNode({ scope, byParent, depth }: { scope: AnalyzedScope; byParent: Map<number, AnalyzedScope[]>; depth: number }) {
  const children = byParent.get(scope.id) ?? [];
  return (
    <div className={depth > 0 ? "ml-6 border-l border-slate-200 pl-4 mt-2" : "mt-2"}>
      <div className={`panel-soft rounded-xl p-3 flex items-center justify-between gap-3 ${scope.status === "closed" ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${scope.status === "open" ? "bg-teal-500" : "bg-slate-300"}`} />
          <span className="font-mono text-xs font-semibold text-slate-800 truncate">{scope.label}</span>
          <span className="font-mono text-[10px] text-slate-400">#{scope.id}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 shrink-0">
          <span>{scope.symbolCount} symbols</span>
          {scope.status === "closed" ? (
            <span className="text-indigo-700 font-semibold">{scope.bytesReclaimed} B reclaimed</span>
          ) : (
            <span className="text-teal-700 font-semibold">open</span>
          )}
        </div>
      </div>
      {children.map((c) => (
        <ScopeNode key={c.id} scope={c} byParent={byParent} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ScopeVisualizer() {
  const { result, loading, error } = useAnalysis();

  if (loading) {
    return <EmptyState title="Compiling…" body="Waiting on the real analyze.exe engine." />;
  }
  if (error) {
    return <EmptyState title="Backend unavailable" body={error} tone="error" />;
  }
  if (!result || result.scopes.length === 0) {
    return (
      <EmptyState
        title="No scope tree yet"
        body="Go to the Compiler page and run Compile / Analyze on a snippet with nested braces to see the scope tree here."
        action={<Link href="/compiler" className="text-indigo-600 text-xs font-semibold hover:underline">Open Compiler →</Link>}
      />
    );
  }

  const byParent = buildTree(result.scopes);
  const root = result.scopes.find((s) => s.parentId === -1);
  const totalReclaimed = result.scopes.filter((s) => s.status === "closed").reduce((a, s) => a + s.bytesReclaimed, 0);
  const closedCount = result.scopes.filter((s) => s.status === "closed").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Scopes" value={String(result.scopes.length)} />
        <Stat label="Closed / Reclaimed" value={String(closedCount)} accent="text-indigo-700" />
        <Stat label="Total Bytes Reclaimed" value={`${totalReclaimed} B`} accent="text-teal-700" />
      </div>
      <div className="panel rounded-2xl p-5">
        {root ? <ScopeNode scope={root} byParent={byParent} depth={0} /> : (
          <div className="text-xs text-slate-400">No root scope found.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="panel rounded-xl p-4 text-center">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-mono font-bold ${accent ?? "text-slate-800"}`}>{value}</div>
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
