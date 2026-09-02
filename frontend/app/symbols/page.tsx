import { SymbolTableExplorer } from "../../components/SymbolTableExplorer";

export default function SymbolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Symbol Table Explorer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every symbol from the most recent Compile / Analyze run, with the
          real representation and reason the C++ policy chose.
        </p>
      </div>
      <SymbolTableExplorer />
    </div>
  );
}
