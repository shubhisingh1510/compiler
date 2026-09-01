// Benchmark harness: runs ConventionalSymbolTable, InternedSymbolTable and
// BudgetSym against 8 deterministic (seeded) synthetic datasets and writes
// real, measured results to results/benchmark_results.csv. Nothing in this
// file is a placeholder -- every row comes from actually running the
// operation and timing it with std::chrono.
#include <chrono>
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <vector>
#include <functional>
#include "../include/conventional_symbol_table.hpp"
#include "../include/interned_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/hires_timer.hpp"

using namespace budgetsym;
static HiResTimer g_timer;

static std::string randomIdentifier(std::mt19937& rng, int minLen, int maxLen) {
    static const char* alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    std::uniform_int_distribution<int> lenDist(minLen, maxLen);
    std::uniform_int_distribution<int> chDist(0, 51);
    int len = lenDist(rng);
    std::string s;
    s.reserve(static_cast<size_t>(len));
    for (int i = 0; i < len; i++) s += alpha[chDist(rng)];
    return s;
}

struct Dataset {
    std::string name;
    std::vector<std::string> identifiers; // in insertion order, duplicates allowed
    size_t budgetBytes;
};

// ---- dataset generators (all deterministic given a fixed seed) -----------

static Dataset genUniformRandom(const std::string& name, int n, int minLen, int maxLen, size_t seed, size_t budget) {
    Dataset d; d.name = name; d.budgetBytes = budget;
    std::mt19937 rng(static_cast<unsigned>(seed));
    for (int i = 0; i < n; i++) d.identifiers.push_back(randomIdentifier(rng, minLen, maxLen));
    return d;
}

// BudgetSym's similarity signal compares each identifier only against the one
// inserted immediately before it (see budget_sym.hpp, decide()) -- that is
// the realistic case (a compiler processing declarations in source order),
// not a global "does this prefix exist anywhere" search. So to actually
// exercise the COMPRESSED path, this dataset groups same-prefix identifiers
// into contiguous runs (like a block of related config-parameter or
// struct-field declarations in real source), rather than interleaving five
// unrelated prefixes item-by-item.
static Dataset genHighPrefixSimilarity(int n, size_t seed, size_t budget) {
    Dataset d; d.name = "high-prefix-similarity"; d.budgetBytes = budget;
    static const char* prefixes[] = {
        "moduleConfigParameter", "temperatureSensorCalibration", "networkInterfaceBuffer",
        "userAuthenticationToken", "compilerSymbolTableEntry"
    };
    (void)seed;
    int groupSize = n / 5;
    for (int p = 0; p < 5; p++) {
        for (int i = 0; i < groupSize; i++) {
            d.identifiers.push_back(std::string(prefixes[p]) + std::to_string(p * groupSize + i));
        }
    }
    return d;
}

static Dataset genNestedScopes(int scopesCount, int symbolsPerScope, size_t seed, size_t budget) {
    Dataset d; d.name = "nested-scopes"; d.budgetBytes = budget;
    std::mt19937 rng(static_cast<unsigned>(seed));
    for (int s = 0; s < scopesCount; s++) {
        for (int i = 0; i < symbolsPerScope; i++) {
            d.identifiers.push_back("scope" + std::to_string(s) + "_" + randomIdentifier(rng, 4, 10));
        }
    }
    return d;
}

// The "hot" fraction is deliberately long + prefix-similar (so BudgetSym starts
// them as COMPRESSED under the default policy); the rest are short/random
// "cold" identifiers that are accessed once and never revisited. The benchmark
// then repeatedly re-looks-up the hot fraction (see runOne), which is what
// should trigger COMPRESSED -> INTERNED promotion for the identifiers that
// actually got compressed initially.
static Dataset genHotColdAccess(int n, size_t seed, size_t budget) {
    Dataset d; d.name = "hot-cold-access"; d.budgetBytes = budget;
    std::mt19937 rng(static_cast<unsigned>(seed));
    int hotN = n / 10;
    for (int i = 0; i < hotN; i++) {
        d.identifiers.push_back("hotPathVariableAccessedFrequently" + std::to_string(i));
    }
    for (int i = hotN; i < n; i++) d.identifiers.push_back(randomIdentifier(rng, 6, 18));
    return d;
}

static Dataset genMemoryStress(int n, size_t seed, size_t tinyBudget) {
    Dataset d; d.name = "memory-stress"; d.budgetBytes = tinyBudget;
    std::mt19937 rng(static_cast<unsigned>(seed));
    for (int i = 0; i < n; i++) d.identifiers.push_back(randomIdentifier(rng, 15, 30));
    return d;
}

// ---- generic timed-operation runner ---------------------------------------

struct Metrics {
    std::string dataset;
    std::string impl;
    size_t symbols = 0;
    long long memory_bytes = 0;
    double memory_per_symbol = 0.0;
    double compression_ratio = 0.0;
    double insert_us = 0.0;
    double lookup_success_us = 0.0;
    double lookup_failure_us = 0.0;
    double scope_enter_us = 0.0;
    double scope_exit_us = 0.0;
};

template <typename Table>
static Metrics runOne(const std::string& implName, const Dataset& ds, Table& table,
                       long long conventionalBytesForRatio) {
    Metrics m;
    m.dataset = ds.name;
    m.impl = implName;

    // insert
    auto t0 = g_timer.now();
    for (auto& id : ds.identifiers) table.insert(id);
    auto t1 = g_timer.now();
    m.insert_us = g_timer.microsecondsBetween(t0, t1) / static_cast<double>(ds.identifiers.size());

    // lookup success: sample every k-th identifier actually inserted
    size_t sampleCount = std::min<size_t>(ds.identifiers.size(), 500);
    size_t stride = ds.identifiers.size() / (sampleCount == 0 ? 1 : sampleCount);
    if (stride == 0) stride = 1;
    std::vector<std::string> successSample;
    for (size_t i = 0; i < ds.identifiers.size(); i += stride) successSample.push_back(ds.identifiers[i]);

    auto t2 = g_timer.now();
    volatile bool sinkHit = false;
    for (auto& id : successSample) sinkHit = sinkHit || table.lookup(id);
    auto t3 = g_timer.now();
    m.lookup_success_us = successSample.empty() ? 0.0 :
        g_timer.microsecondsBetween(t2, t3) / static_cast<double>(successSample.size());

    // lookup failure: guaranteed-absent identifiers
    std::vector<std::string> failSample;
    for (size_t i = 0; i < successSample.size(); i++) failSample.push_back("ZZZ_ABSENT_" + std::to_string(i) + "_XYZ");
    auto t4 = g_timer.now();
    volatile bool sinkMiss = false;
    for (auto& id : failSample) sinkMiss = sinkMiss || table.lookup(id);
    auto t5 = g_timer.now();
    m.lookup_failure_us = failSample.empty() ? 0.0 :
        g_timer.microsecondsBetween(t4, t5) / static_cast<double>(failSample.size());
    (void)sinkHit; (void)sinkMiss;

    // hot-cold-access dataset: repeatedly re-look-up a "hot" subset (first 10%
    // of the success sample) enough times to cross BudgetSym's default
    // hotAccessThreshold, so this dataset actually exercises the promotion
    // mechanic instead of just being a differently-named random dataset. This
    // is a no-op for Conventional/Interned (they have no promotion concept)
    // beyond incrementing their own accessCount bookkeeping.
    if (ds.name == "hot-cold-access" && !successSample.empty()) {
        size_t hotCount = std::max<size_t>(1, successSample.size() / 10);
        for (int r = 0; r < 4; r++) {
            for (size_t i = 0; i < hotCount; i++) table.lookup(successSample[i]);
        }
    }

    // scope enter/exit: enter a fresh scope, insert 200 more symbols into it
    // (so exitScope() has real reclamation work to do), time enter+exit
    // separately. enterScope() itself is O(1) (just pushes a stack frame) so
    // it's timed over many repeated enter/exit pairs to get a measurable total.
    const int scopeRepeats = 200;
    auto t6 = g_timer.now();
    for (int r = 0; r < scopeRepeats; r++) table.enterScope();
    auto t7 = g_timer.now();
    m.scope_enter_us = g_timer.microsecondsBetween(t6, t7) / static_cast<double>(scopeRepeats);
    for (int r = 0; r < scopeRepeats - 1; r++) table.exitScope(); // pop back down to 1 open scope, cheap (empty)

    std::mt19937 rng(12345);
    for (int i = 0; i < 200; i++) table.insert(randomIdentifier(rng, 4, 10));

    auto t8 = g_timer.now();
    table.exitScope();
    auto t9 = g_timer.now();
    m.scope_exit_us = g_timer.microsecondsBetween(t8, t9);

    m.symbols = table.size();
    m.memory_bytes = table.tracker().current();
    m.memory_per_symbol = m.symbols > 0 ? static_cast<double>(m.memory_bytes) / static_cast<double>(m.symbols) : 0.0;
    m.compression_ratio = m.memory_bytes > 0 && conventionalBytesForRatio > 0
        ? static_cast<double>(conventionalBytesForRatio) / static_cast<double>(m.memory_bytes)
        : 1.0;
    return m;
}

static void writeCsvHeader(std::ofstream& out) {
    out << "dataset,implementation,symbols,memory_bytes,memory_per_symbol,compression_ratio,"
           "insert_us,lookup_success_us,lookup_failure_us,scope_enter_us,scope_exit_us\n";
}

static void writeCsvRow(std::ofstream& out, const Metrics& m) {
    out << m.dataset << "," << m.impl << "," << m.symbols << "," << m.memory_bytes << ","
        << m.memory_per_symbol << "," << m.compression_ratio << "," << m.insert_us << ","
        << m.lookup_success_us << "," << m.lookup_failure_us << "," << m.scope_enter_us << ","
        << m.scope_exit_us << "\n";
}

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
        Metrics convM = runOne("Conventional", ds, conv, 0);
        convM.compression_ratio = 1.0; // conventional is the reference point
        long long conventionalBytes = convM.memory_bytes;

        InternedSymbolTable interned(ds.budgetBytes);
        Metrics internedM = runOne("Interned", ds, interned, conventionalBytes);

        BudgetSym budgetSym(ds.budgetBytes);
        Metrics budgetM = runOne("BudgetSym", ds, budgetSym, conventionalBytes);

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
