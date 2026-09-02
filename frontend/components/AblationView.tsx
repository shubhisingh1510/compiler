"use client";

import React, { useEffect, useState } from "react";
import { ablationRows as fallbackRows, AblationRow } from "../lib/benchmark-data";

function getVariantLabel(v: string) {
  switch (v) {
    case "BudgetSym-Full":
      return { title: "BudgetSym — Full Policy", desc: "All mechanisms enabled (scope stack, access frequency, adaptive selection)", isFull: true };
    case "BudgetSym-NoScope":
      return { title: "Ablation: No Scope Stack", desc: "Scopes are entered but never exited — no memory reclamation", isFull: false };
    case "BudgetSym-NoAccessFrequency":
      return { title: "Ablation: No Access Frequency", desc: "hotAccessThreshold set unreachable — promotion never fires", isFull: false };
    case "BudgetSym-NoAdaptiveSelection":
      return { title: "Ablation: No Adaptive Selection", desc: "decide() bypassed — every symbol forced to INTERNED", isFull: false };
    default:
      return { title: v, desc: "", isFull: false };
  }
}

export function AblationView() {
  const [rows, setRows] = useState<AblationRow[]>(fallbackRows);
  const [source, setSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    fetch("/api/experiments")
      .then((r) => r.json())
      .then((data) => {
        if (data.available && Array.isArray(data.rows) && data.rows.length > 0) {
          setRows(data.rows);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="panel p-6 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-mono font-bold text-slate-900">
            Which policy mechanism contributes how much to the result?
          </h2>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${source === "live" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {source === "live" ? "results/ablation_results.csv" : "bundled snapshot"}
          </span>
        </div>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          To verify that every component in BudgetSym earns its place, each mechanism was
          systematically disabled in isolation on the same fixed workload. Below are the
          measured impacts on memory footprint, runtime promotions, insert/lookup latency, and
          total bytes reclaimed.
        </p>
      </div>

      {/* Grid of Ablation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rows.map((row) => {
          const info = getVariantLabel(row.variant);
          return (
            <div
              key={row.variant}
              className={`panel card-hover p-5 rounded-2xl ${info.isFull ? "border-teal-300 ring-1 ring-teal-100" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  info.isFull ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {info.isFull ? "Baseline Full" : "Variant"}
                </span>
                <span className="font-mono text-xs text-slate-400">{row.symbols} symbols</span>
              </div>

              <h3 className="font-mono text-sm font-bold text-slate-900 mb-1">{info.title}</h3>
              <p className="text-xs text-slate-500 mb-4 min-h-[32px]">{info.desc}</p>

              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs font-mono">
                <Row label="Memory / Symbol" value={`${Number(row.memory_per_symbol).toFixed(2)} B`} accent="text-teal-700" />
                <Row label="Promotions" value={String(row.promotions)} accent={Number(row.promotions) > 0 ? "text-amber-700" : "text-slate-400"} />
                <Row label="Insert Latency" value={`${Number(row.insert_us).toFixed(3)} µs`} />
                <Row label="Lookup Latency" value={`${Number(row.lookup_us).toFixed(3)} µs`} />
                <div className="border-t border-slate-100 pt-2">
                  <Row label="Bytes Reclaimed" value={Number(row.bytes_reclaimed_total).toLocaleString() + " B"} accent="text-indigo-700" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between items-center text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold ${accent ?? "text-slate-700"}`}>{value}</span>
    </div>
  );
}
