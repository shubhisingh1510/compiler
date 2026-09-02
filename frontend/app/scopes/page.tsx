import { ScopeVisualizer } from "../../components/ScopeVisualizer";

export default function ScopesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Scope Visualizer</h1>
        <p className="text-sm text-slate-500 mt-1">
          The scope tree from the most recent Compile / Analyze run — real
          enter/exit events replayed through <code className="text-xs bg-slate-100 px-1 rounded">BudgetSym::enterScope()</code> / <code className="text-xs bg-slate-100 px-1 rounded">exitScope()</code>.
        </p>
      </div>
      <ScopeVisualizer />
    </div>
  );
}
