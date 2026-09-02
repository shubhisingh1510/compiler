import { BenchmarkCharts } from "../../components/BenchmarkCharts";
import { LatencyTable } from "../../components/LatencyTable";

export default function BenchmarksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Benchmarks</h1>
        <p className="text-sm text-slate-500 mt-1">
          8 synthetic datasets × 3 implementations, measured with a working
          high-resolution timer — see docs/methodology.md for why a custom
          timer was needed on this toolchain.
        </p>
      </div>
      <BenchmarkCharts />
      <LatencyTable />
    </div>
  );
}
