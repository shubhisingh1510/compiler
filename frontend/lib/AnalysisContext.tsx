"use client";
// Shares the most recent /api/analyze result (the REAL BudgetSym engine's
// output for whatever source was last compiled on the Compiler page) across
// the Compiler, Symbol Table, and Scopes pages -- so "Compile" on one page
// and "inspect the result" on another are the same real run, not separate
// fabricated views.
import React, { createContext, useContext, useState, useCallback } from "react";

export interface AnalyzedSymbol {
  id: number;
  name: string;
  scopeId: number;
  typeHint: string;
  representation: "INLINE" | "INTERNED" | "COMPRESSED";
  reason: string;
}

export interface AnalyzedScope {
  id: number;
  parentId: number;
  label: string;
  symbolCount: number;
  status: "open" | "closed";
  bytesReclaimed: number;
}

export interface AnalyzeResult {
  budgetBytes: number;
  trackedMemoryBytes: number;
  conventionalMemoryBytes: number;
  compressionRatio: number;
  promotions: number;
  liveSymbolCount: number;
  memoryPressure: number;
  symbols: AnalyzedSymbol[];
  scopes: AnalyzedScope[];
  extractionWarnings: string[];
  declarationCount: number;
  scopeCount: number;
}

interface AnalysisState {
  result: AnalyzeResult | null;
  loading: boolean;
  error: string | null;
  sourceCode: string;
  run: (code: string, budgetBytes: number, config?: Partial<Record<string, number>>) => Promise<void>;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState("");

  const run = useCallback(async (code: string, budgetBytes: number, config?: Partial<Record<string, number>>) => {
    setLoading(true);
    setError(null);
    setSourceCode(code);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, budgetBytes, config }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || `Request failed (${res.status})`);
        setResult(null);
        return;
      }
      setResult(data as AnalyzeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error reaching /api/analyze.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AnalysisContext.Provider value={{ result, loading, error, sourceCode, run }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisState {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
