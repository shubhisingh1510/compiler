// Benchmark harness: runs ConventionalSymbolTable, InternedSymbolTable and
// BudgetSym against 8 deterministic (seeded) synthetic datasets and writes
// real, measured results to results/benchmark_results.csv. Nothing in this
// file is a placeholder -- every row comes from actually running the
// operation and timing it with std::chrono.
//
// Dataset generation and per-implementation timing/CSV logic live in
// include/dataset_generators.hpp and include/bench_metrics.hpp so that
// grid_search_main.cpp, corpus_bench_main.cpp and multiseed_main.cpp can
// reuse them without duplication (Review-2 additions).
#include <fstream>
#include <iostream>
#include <vector>
#include "../include/conventional_symbol_table.hpp"
#include "../include/interned_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"
#include "../include/bench_metrics.hpp"

using namespace budgetsym;
static HiResTimer g_timer;

int main() {
    const size_t seed = 42;
    const size_t defaultBudget = 64ull * 1024 * 1024; // generous, so pressure() stays near 0 except memory-stress
    const size_t tinyBudget = 8192;                    // forces real memory pressure

    std::vector<Dataset> datasets;
    datasets.push_back(genUniformRandom("small", 100, 4, 12, seed, defaultBudget));
    datasets.push_back(genUniformRandom("medium", 2000, 4, 16, seed + 1, defaultBudget));
    datasets.push_back(genUniformRandom("large", 20000, 4, 16, seed + 2, defaultBudget));
    datasets.push_back(genHighPrefixSimilarity(2000, seed + 3, defaultBudget));
    datasets.push_back(genUniformRandom("random-identifiers", 2000, 3, 24, seed + 4, defaultBudget));
    datasets.push_back(genNestedScopes(40, 25, seed + 5, defaultBudget)); // 40 scopes * 25 symbols = 1000
    datasets.push_back(genHotColdAccess(1500, seed + 6, defaultBudget));
    datasets.push_back(genMemoryStress(1500, seed + 7, tinyBudget));

    std::ofstream out("results/benchmark_results.csv");
    if (!out) {
        std::cerr << "ERROR: could not open results/benchmark_results.csv for writing "
                     "(run this binary from the repo root so results/ resolves)\n";
        return 1;
    }
    writeCsvHeader(out);

    for (auto& ds : datasets) {
        std::cout << "Running dataset: " << ds.name << " (" << ds.identifiers.size()
                  << " identifiers, budget=" << ds.budgetBytes << " bytes)\n";

        ConventionalSymbolTable conv(ds.budgetBytes);
        Metrics convM = runOne(g_timer, "Conventional", ds, conv, 0);
        convM.compression_ratio = 1.0; // conventional is the reference point
        long long conventionalBytes = convM.memory_bytes;

        InternedSymbolTable interned(ds.budgetBytes);
        Metrics internedM = runOne(g_timer, "Interned", ds, interned, conventionalBytes);

        BudgetSym budgetSym(ds.budgetBytes);
        Metrics budgetM = runOne(g_timer, "BudgetSym", ds, budgetSym, conventionalBytes);

        writeCsvRow(out, convM);
        writeCsvRow(out, internedM);
        writeCsvRow(out, budgetM);

        std::cout << "  Conventional: " << convM.memory_bytes << " bytes tracked, "
                  << conv.size() << " symbols\n";
        std::cout << "  Interned:     " << internedM.memory_bytes << " bytes tracked ("
                  << internedM.compression_ratio << "x vs conventional)\n";
        std::cout << "  BudgetSym:    " << budgetM.memory_bytes << " bytes tracked ("
                  << budgetM.compression_ratio << "x vs conventional), "
                  << budgetSym.promotions() << " promotions\n";
    }

    out.close();
    std::cout << "\nWrote results/benchmark_results.csv\n";
    return 0;
}
