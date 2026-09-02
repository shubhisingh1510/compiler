// Benchmark and ablation datasets from actual C++ runs (results/*.csv)
// Stored as typed static constants for instant client-side rendering and SSR.

export interface BenchmarkRow {
  dataset: string;
  implementation: "Conventional" | "Interned" | "BudgetSym";
  symbols: number;
  memory_bytes: number;
  memory_per_symbol: number;
  compression_ratio: number;
  insert_us: number;
  lookup_success_us: number;
  lookup_failure_us: number;
  scope_enter_us: number;
  scope_exit_us: number;
}

export interface AblationRow {
  variant: string;
  symbols: number;
  memory_bytes: number;
  memory_per_symbol: number;
  promotions: number;
  insert_us: number;
  lookup_us: number;
  bytes_reclaimed_total: number;
}

export const benchmarkRows: BenchmarkRow[] = [
  { dataset: "small", implementation: "Conventional", symbols: 100, memory_bytes: 6505, memory_per_symbol: 65.05, compression_ratio: 1.0, insert_us: 0.527, lookup_success_us: 0.004, lookup_failure_us: 0.039, scope_enter_us: 0.066, scope_exit_us: 7.4 },
  { dataset: "small", implementation: "Interned", symbols: 100, memory_bytes: 6105, memory_per_symbol: 61.05, compression_ratio: 1.06552, insert_us: 0.438, lookup_success_us: 0.005, lookup_failure_us: 0.041, scope_enter_us: 0.072, scope_exit_us: 6.1 },
  { dataset: "small", implementation: "BudgetSym", symbols: 100, memory_bytes: 3945, memory_per_symbol: 39.45, compression_ratio: 1.64892, insert_us: 0.75, lookup_success_us: 0.007, lookup_failure_us: 0.051, scope_enter_us: 0.093, scope_exit_us: 8.6 },

  { dataset: "medium", implementation: "Conventional", symbols: 2000, memory_bytes: 133870, memory_per_symbol: 66.935, compression_ratio: 1.0, insert_us: 0.19185, lookup_success_us: 0.0016, lookup_failure_us: 0.04, scope_enter_us: 0.064, scope_exit_us: 5.5 },
  { dataset: "medium", implementation: "Interned", symbols: 2000, memory_bytes: 125870, memory_per_symbol: 62.935, compression_ratio: 1.06356, insert_us: 0.3497, lookup_success_us: 0.001, lookup_failure_us: 0.043, scope_enter_us: 0.1035, scope_exit_us: 5.6 },
  { dataset: "medium", implementation: "BudgetSym", symbols: 2000, memory_bytes: 95942, memory_per_symbol: 47.971, compression_ratio: 1.39532, insert_us: 0.6111, lookup_success_us: 0.0016, lookup_failure_us: 0.056, scope_enter_us: 0.048, scope_exit_us: 6.3 },

  { dataset: "large", implementation: "Conventional", symbols: 20000, memory_bytes: 1339656, memory_per_symbol: 66.9828, compression_ratio: 1.0, insert_us: 0.21311, lookup_success_us: 0.0022, lookup_failure_us: 0.0782, scope_enter_us: 0.08, scope_exit_us: 5.3 },
  { dataset: "large", implementation: "Interned", symbols: 20000, memory_bytes: 1259656, memory_per_symbol: 62.9828, compression_ratio: 1.06351, insert_us: 0.384685, lookup_success_us: 0.0026, lookup_failure_us: 0.0762, scope_enter_us: 0.058, scope_exit_us: 5.6 },
  { dataset: "large", implementation: "BudgetSym", symbols: 20000, memory_bytes: 963136, memory_per_symbol: 48.1568, compression_ratio: 1.39093, insert_us: 0.58826, lookup_success_us: 0.0022, lookup_failure_us: 0.1572, scope_enter_us: 0.0925, scope_exit_us: 5.5 },

  { dataset: "high-prefix-similarity", implementation: "Conventional", symbols: 2000, memory_bytes: 168090, memory_per_symbol: 84.045, compression_ratio: 1.0, insert_us: 0.2408, lookup_success_us: 0.002, lookup_failure_us: 0.0598, scope_enter_us: 0.1725, scope_exit_us: 5.9 },
  { dataset: "high-prefix-similarity", implementation: "Interned", symbols: 2000, memory_bytes: 160090, memory_per_symbol: 80.045, compression_ratio: 1.04997, insert_us: 0.41685, lookup_success_us: 0.002, lookup_failure_us: 0.0746, scope_enter_us: 0.123, scope_exit_us: 5.3 },
  { dataset: "high-prefix-similarity", implementation: "BudgetSym", symbols: 2000, memory_bytes: 71044, memory_per_symbol: 35.522, compression_ratio: 2.366, insert_us: 1.41015, lookup_success_us: 0.002, lookup_failure_us: 0.053, scope_enter_us: 0.057, scope_exit_us: 5.8 },

  { dataset: "random-identifiers", implementation: "Conventional", symbols: 2000, memory_bytes: 141354, memory_per_symbol: 70.677, compression_ratio: 1.0, insert_us: 0.21645, lookup_success_us: 0.0016, lookup_failure_us: 0.0362, scope_enter_us: 0.043, scope_exit_us: 5.3 },
  { dataset: "random-identifiers", implementation: "Interned", symbols: 2000, memory_bytes: 133354, memory_per_symbol: 66.677, compression_ratio: 1.05999, insert_us: 0.41305, lookup_success_us: 0.001, lookup_failure_us: 0.0348, scope_enter_us: 0.051, scope_exit_us: 5.5 },
  { dataset: "random-identifiers", implementation: "BudgetSym", symbols: 2000, memory_bytes: 114202, memory_per_symbol: 57.101, compression_ratio: 1.23775, insert_us: 0.67855, lookup_success_us: 0.002, lookup_failure_us: 0.0546, scope_enter_us: 0.0435, scope_exit_us: 5.5 },

  { dataset: "nested-scopes", implementation: "Conventional", symbols: 1000, memory_bytes: 71767, memory_per_symbol: 71.767, compression_ratio: 1.0, insert_us: 0.2091, lookup_success_us: 0.002, lookup_failure_us: 0.039, scope_enter_us: 0.047, scope_exit_us: 5.0 },
  { dataset: "nested-scopes", implementation: "Interned", symbols: 1000, memory_bytes: 67767, memory_per_symbol: 67.767, compression_ratio: 1.05903, insert_us: 0.3487, lookup_success_us: 0.0012, lookup_failure_us: 0.0348, scope_enter_us: 0.061, scope_exit_us: 5.1 },
  { dataset: "nested-scopes", implementation: "BudgetSym", symbols: 1000, memory_bytes: 39039, memory_per_symbol: 39.039, compression_ratio: 1.83834, insert_us: 0.8638, lookup_success_us: 0.002, lookup_failure_us: 0.0636, scope_enter_us: 0.06, scope_exit_us: 5.4 },

  { dataset: "hot-cold-access", implementation: "Conventional", symbols: 1500, memory_bytes: 107041, memory_per_symbol: 71.3607, compression_ratio: 1.0, insert_us: 0.216133, lookup_success_us: 0.0016, lookup_failure_us: 0.041, scope_enter_us: 0.0455, scope_exit_us: 5.3 },
  { dataset: "hot-cold-access", implementation: "Interned", symbols: 1500, memory_bytes: 101041, memory_per_symbol: 67.3607, compression_ratio: 1.05938, insert_us: 0.385533, lookup_success_us: 0.001, lookup_failure_us: 0.0434, scope_enter_us: 0.0445, scope_exit_us: 5.6 },
  { dataset: "hot-cold-access", implementation: "BudgetSym", symbols: 1500, memory_bytes: 80893, memory_per_symbol: 53.9287, compression_ratio: 1.32324, insert_us: 0.668667, lookup_success_us: 0.0026, lookup_failure_us: 0.058, scope_enter_us: 0.053, scope_exit_us: 5.4 },

  { dataset: "memory-stress", implementation: "Conventional", symbols: 1500, memory_bytes: 118926, memory_per_symbol: 79.284, compression_ratio: 1.0, insert_us: 0.211933, lookup_success_us: 0.0014, lookup_failure_us: 0.042, scope_enter_us: 0.05, scope_exit_us: 5.0 },
  { dataset: "memory-stress", implementation: "Interned", symbols: 1500, memory_bytes: 112926, memory_per_symbol: 75.284, compression_ratio: 1.05313, insert_us: 0.403933, lookup_success_us: 0.001, lookup_failure_us: 0.0388, scope_enter_us: 0.0505, scope_exit_us: 5.3 },
  { dataset: "memory-stress", implementation: "BudgetSym", symbols: 1500, memory_bytes: 83343, memory_per_symbol: 55.562, compression_ratio: 1.42695, insert_us: 1.27393, lookup_success_us: 0.0048, lookup_failure_us: 0.0594, scope_enter_us: 0.061, scope_exit_us: 6.8 },
];

export const ablationRows: AblationRow[] = [
  { variant: "BudgetSym-Full", symbols: 800, memory_bytes: 33581, memory_per_symbol: 41.9763, promotions: 4, insert_us: 0.807833, lookup_us: 0.84, bytes_reclaimed_total: 15115 },
  { variant: "BudgetSym-NoScope", symbols: 1200, memory_bytes: 48696, memory_per_symbol: 40.58, promotions: 4, insert_us: 0.709333, lookup_us: 1.176, bytes_reclaimed_total: 0 },
  { variant: "BudgetSym-NoAccessFrequency", symbols: 800, memory_bytes: 33430, memory_per_symbol: 41.7875, promotions: 0, insert_us: 0.669583, lookup_us: 0.744, bytes_reclaimed_total: 15115 },
  { variant: "BudgetSym-NoAdaptiveSelection", symbols: 800, memory_bytes: 50642, memory_per_symbol: 63.3025, promotions: 0, insert_us: 0.81275, lookup_us: 0.412, bytes_reclaimed_total: 25227 },
];

export const DATASETS = Array.from(new Set(benchmarkRows.map((r) => r.dataset)));
export const IMPLEMENTATIONS = ["Conventional", "Interned", "BudgetSym"] as const;

export function rowFor(dataset: string, implementation: "Conventional" | "Interned" | "BudgetSym"): BenchmarkRow | undefined {
  return benchmarkRows.find((r) => r.dataset === dataset && r.implementation === implementation);
}
