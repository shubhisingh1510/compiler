import { CacheBenchmarkView } from "../../components/CacheBenchmarkView";
import { AlgorithmComparisonView } from "../../components/AlgorithmComparisonView";

export default function AlgorithmsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Algorithms</h1>
        <p className="text-sm text-slate-500 mt-1">
          Two follow-ups to the lookup-latency question in Benchmarks: does
          caching help, and how do alternative hashing/storage backends
          (MurmurHash3, DJB2, Robin Hood open addressing, a shared trie)
          compare against BudgetSym on the same datasets.
        </p>
      </div>
      <CacheBenchmarkView />
      <AlgorithmComparisonView />
    </div>
  );
}
