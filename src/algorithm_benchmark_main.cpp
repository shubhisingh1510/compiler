// Hashing/compression algorithm comparison: BudgetSym-FNV1a (today's
// default), BudgetSym-Murmur3, BudgetSym-DJB2 (same adaptive policy,
// different index hash -- see include/hash_functions.hpp), RobinHood
// (direct string-keyed open addressing, no adaptive selection -- see
// include/robinhood_symbol_table.hpp), and Trie (shared prefix tree, no
// adaptive selection -- see include/trie_symbol_table.hpp), compared on the
// same 8 datasets using the same runOne()/Metrics machinery as
// benchmark_main.cpp (include/bench_metrics.hpp), so results are directly
// comparable to that file's Table/Figure numbers.
//
// Full writeup and honest findings (RobinHood wins lookup latency and
// BudgetSym wins compression on literally every dataset tested, hash
// function choice within BudgetSym barely matters) in
// docs/algorithm_comparison.md.
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include "../include/conventional_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/robinhood_symbol_table.hpp"
#include "../include/trie_symbol_table.hpp"
#include "../include/dataset_generators.hpp"
#include "../include/bench_metrics.hpp"
#include "../include/hires_timer.hpp"

using namespace budgetsym;
static HiResTimer g_timer;

static void writeHeader(std::ofstream& out) {
    out << "dataset,algorithm,symbols,memory_bytes,memory_per_symbol,compression_ratio,slack_bytes,"
           "insert_us,lookup_success_us,lookup_failure_us\n";
}

static void writeRow(std::ofstream& out, const Metrics& m, long long slackBytes = 0) {
    out << m.dataset << "," << m.impl << "," << m.symbols << "," << m.memory_bytes << ","
        << m.memory_per_symbol << "," << m.compression_ratio << "," << slackBytes << ","
        << m.insert_us << "," << m.lookup_success_us << "," << m.lookup_failure_us << "\n";
}

int main() {
    const size_t seed = 42;
    const size_t defaultBudget = 64ull * 1024 * 1024;
    const size_t tinyBudget = 8192;

    std::vector<Dataset> datasets;
    datasets.push_back(genUniformRandom("small", 100, 4, 12, seed, defaultBudget));
    datasets.push_back(genUniformRandom("medium", 2000, 4, 16, seed + 1, defaultBudget));
    datasets.push_back(genUniformRandom("large", 20000, 4, 16, seed + 2, defaultBudget));
    datasets.push_back(genHighPrefixSimilarity(2000, seed + 3, defaultBudget));
    datasets.push_back(genUniformRandom("random-identifiers", 2000, 3, 24, seed + 4, defaultBudget));
    datasets.push_back(genNestedScopes(40, 25, seed + 5, defaultBudget));
    datasets.push_back(genHotColdAccess(1500, seed + 6, defaultBudget));
    datasets.push_back(genMemoryStress(1500, seed + 7, tinyBudget));

    std::ofstream out("results/algorithm_comparison.csv");
    if (!out) {
        std::cerr << "ERROR: could not open results/algorithm_comparison.csv (run from repo root)\n";
        return 1;
    }
    writeHeader(out);

    for (auto& ds : datasets) {
        std::cout << "Running dataset: " << ds.name << "\n";

        ConventionalSymbolTable conv(ds.budgetBytes);
        for (auto& id : ds.identifiers) conv.insert(id);
        long long conventionalBytes = conv.tracker().current();

        BudgetSym fnv(ds.budgetBytes);
        writeRow(out, runOne(g_timer, "BudgetSym-FNV1a", ds, fnv, conventionalBytes));

        BudgetSymMurmur3 mm3(ds.budgetBytes);
        writeRow(out, runOne(g_timer, "BudgetSym-Murmur3", ds, mm3, conventionalBytes));

        BudgetSymDjb2 djb2(ds.budgetBytes);
        writeRow(out, runOne(g_timer, "BudgetSym-DJB2", ds, djb2, conventionalBytes));

        RobinHoodSymbolTable rh(ds.budgetBytes);
        Metrics rhM = runOne(g_timer, "RobinHood", ds, rh, conventionalBytes);
        writeRow(out, rhM, rh.slackBytes());

        TrieSymbolTable trie(ds.budgetBytes);
        writeRow(out, runOne(g_timer, "Trie", ds, trie, conventionalBytes));

        std::cout << "  done.\n";
    }

    out.close();
    std::cout << "\nWrote results/algorithm_comparison.csv\n";
    return 0;
}
