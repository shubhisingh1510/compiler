import { MemoryAnalytics } from "../../components/MemoryAnalytics";

export default function MemoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Memory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Budget, pressure, and the memory/latency trade-off — all from
          measured benchmark data, not synthesized.
        </p>
      </div>
      <MemoryAnalytics />
    </div>
  );
}
