// Multi-seed statistical validation harness (Review-2, plan Step 2).
//
// Re-runs each of the 8 synthetic dataset families from benchmark_main.cpp
// across 30 distinct seeds, insert()-only (no lookup/scope timing -- only
// compression_ratio matters here, same reasoning as grid_search_main.cpp),
// and writes raw per-(dataset,seed,implementation) rows to
// results/multiseed_raw.csv for scripts/multiseed_stats.py to aggregate into
// means/CIs/p-values.
//
// Seed base is 1000 + familyIndex*100 + seedIndex (familyIndex 0..7,
// seedIndex 0..29) -- deliberately disjoint from benchmark_main.cpp's 42..49
// range so there is never any confusion about which run produced which seed.
#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include "../include/conventional_symbol_table.hpp"
#include "../include/interned_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"

using namespace budgetsym;

// Builds one of the 8 dataset families (same construction as benchmark_main.cpp)
// for the given seed. familyIndex selects which family; seed drives the RNG.
static Dataset buildDataset(int familyIndex, size_t seed) {
    const size_t defaultBudget = 64ull * 1024 * 1024;
    const size_t tinyBudget = 8192;
    switch (familyIndex) {
        case 0: return genUniformRandom("small", 100, 4, 12, seed, defaultBudget);
        case 1: return genUniformRandom("medium", 2000, 4, 16, seed, defaultBudget);
        case 2: return genUniformRandom("large", 20000, 4, 16, seed, defaultBudget);
        case 3: return genHighPrefixSimilaritySeeded(2000, seed, defaultBudget);
        case 4: return genUniformRandom("random-identifiers", 2000, 3, 24, seed, defaultBudget);
        case 5: return genNestedScopes(40, 25, seed, defaultBudget);
        case 6: return genHotColdAccess(1500, seed, defaultBudget);
        case 7: return genMemoryStress(1500, seed, tinyBudget);
    }
    throw std::runtime_error("bad familyIndex");
}

// Runs insert()-only over the dataset with the given table type and returns
// the tracked memory footprint in bytes.
template <typename Table>
static long long runInsertOnly(const Dataset& ds, Table& table) {
    for (auto& id : ds.identifiers) table.insert(id);
    return table.tracker().current();
}

int main() {
    const int kFamilies = 8;
    const int kSeeds = 30;
    const size_t seedBase = 1000;

    std::ostringstream buf;
    buf << "dataset,seed_index,implementation,compression_ratio,memory_bytes\n";

    for (int f = 0; f < kFamilies; f++) {
        // Peek the dataset name once for progress printing (name is fixed
        // per family regardless of seed).
        std::string familyName = buildDataset(f, seedBase + f * 100).name;
        std::cout << "Running family: " << familyName << " (30 seeds)\n";

        for (int s = 0; s < kSeeds; s++) {
            size_t seed = seedBase + f * 100 + s;
            Dataset ds = buildDataset(f, seed);

            ConventionalSymbolTable conv(ds.budgetBytes);
            long long conventionalBytes = runInsertOnly(ds, conv);

            InternedSymbolTable interned(ds.budgetBytes);
            long long internedBytes = runInsertOnly(ds, interned);

            BudgetSym budgetSym(ds.budgetBytes);
            long long budgetBytes = runInsertOnly(ds, budgetSym);

            double internedRatio = internedBytes > 0
                ? static_cast<double>(conventionalBytes) / static_cast<double>(internedBytes)
                : 0.0;
            double budgetRatio = budgetBytes > 0
                ? static_cast<double>(conventionalBytes) / static_cast<double>(budgetBytes)
                : 0.0;

            buf << ds.name << "," << s << ",Conventional,1,"
                << conventionalBytes << "\n";
            buf << ds.name << "," << s << ",Interned," << internedRatio << ","
                << internedBytes << "\n";
            buf << ds.name << "," << s << ",BudgetSym," << budgetRatio << ","
                << budgetBytes << "\n";
        }
    }

    std::ofstream out("results/multiseed_raw.csv");
    if (!out) {
        std::cerr << "ERROR: could not open results/multiseed_raw.csv for writing "
                     "(run this binary from the repo root so results/ resolves)\n";
        return 1;
    }
    out << buf.str();
    out.close();
    std::cout << "\nWrote results/multiseed_raw.csv\n";
    return 0;
}
