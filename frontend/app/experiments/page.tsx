import { AblationView } from "../../components/AblationView";

export default function ExperimentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Experiments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ablation study — each BudgetSym mechanism disabled in isolation on
          the same fixed workload, to isolate which one is responsible for
          how much of the result.
        </p>
      </div>
      <AblationView />
    </div>
  );
}
