// Does the Review-2 LRU lookup cache (include/lookup_cache.hpp, wired into
// BudgetSym via setLookupCacheEnabled()) actually reduce lookup latency, and
// under what access pattern? Uses the same 8 datasets as benchmark_main.cpp
// (include/dataset_generators.hpp).
//
// Two lookup phases per dataset, deliberately different:
//   cold_lookup_us     : each sampled identifier looked up exactly ONCE.
//                        The cache cannot help here -- every lookup is a
//                        first-time query, i.e. a guaranteed miss -- so this
//                        phase's job is to show the cache's bookkeeping
//                        overhead on a workload it cannot help.
//   repeated_lookup_us : a bounded hot subset (sized to fit inside the
//                        cache's fixed 64-entry capacity -- see
//                        LRULookupCache<64> in budget_sym.hpp) looked up
//                        repeatedly. This is the access pattern the cache
//                        actually targets. Using the FULL sample here would
//                        thrash a 64-entry cache into a ~0% hit rate
//                        regardless of the cache's real behavior -- a bug
//                        caught while building the first version of this
//                        file (see docs/caching.md) and independently
//                        avoided in benchmark_main.cpp's own hot-cold-access
//                        handling with the same reasoning.
// Reporting both, not just the flattering second one, is deliberate.
#include <algorithm>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"
#include "../include/hires_timer.hpp"

using namespace budgetsym;
static HiResTimer g_timer;

struct CacheMetrics {
    std::string dataset;
    bool cacheEnabled = false;
    size_t symbols = 0;
    double insert_us = 0.0;
    double cold_lookup_us = 0.0;
    double repeated_lookup_us = 0.0;
    double cache_hit_rate = 0.0;
    double speedup_vs_no_cache_x = 0.0;
};

static const int kRepeats = 10;

static CacheMetrics runVariant(const Dataset& ds, bool cacheEnabled) {
    CacheMetrics m;
    m.dataset = ds.name;
    m.cacheEnabled = cacheEnabled;

    BudgetSym table(ds.budgetBytes);
    table.setLookupCacheEnabled(cacheEnabled);

    auto t0 = g_timer.now();
    for (auto& id : ds.identifiers) table.insert(id);
    auto t1 = g_timer.now();
    m.insert_us = g_timer.microsecondsBetween(t0, t1) / static_cast<double>(ds.identifiers.size());

    size_t sampleCount = std::min<size_t>(ds.identifiers.size(), 500);
    size_t stride = ds.identifiers.size() / (sampleCount == 0 ? 1 : sampleCount);
    if (stride == 0) stride = 1;
    std::vector<std::string> sample;
    for (size_t i = 0; i < ds.identifiers.size(); i += stride) sample.push_back(ds.identifiers[i]);
    if (sample.empty()) { m.symbols = table.size(); return m; }

    volatile bool sink = false;
    auto t2 = g_timer.now();
    for (auto& id : sample) { bool hit = table.lookup(id); sink = sink || hit; }
    auto t3 = g_timer.now();
    m.cold_lookup_us = g_timer.microsecondsBetween(t2, t3) / static_cast<double>(sample.size());

    // Fresh table for the repeated-hot-subset phase, not the one the cold
    // sweep above just ran 500 lookups across -- reusing it would mean the
    // cold sweep's tail evicts the hot subset from the 64-entry cache before
    // this phase starts (see file header comment).
    BudgetSym hotTable(ds.budgetBytes);
    hotTable.setLookupCacheEnabled(cacheEnabled);
    for (auto& id : ds.identifiers) hotTable.insert(id);
    size_t hotSubsetSize = std::min<size_t>(sample.size(), 32); // well under the 64-entry cache
    std::vector<std::string> hotSubset(sample.begin(), sample.begin() + static_cast<long>(hotSubsetSize));

    auto t4 = g_timer.now();
    for (int r = 0; r < kRepeats; r++) {
        for (auto& id : hotSubset) { bool hit = hotTable.lookup(id); sink = sink || hit; }
    }
    auto t5 = g_timer.now();
    (void)sink;
    m.repeated_lookup_us = hotSubset.empty() ? 0.0 :
        g_timer.microsecondsBetween(t4, t5) / static_cast<double>(kRepeats * hotSubset.size());
    m.cache_hit_rate = hotTable.statistics().lookupCache.hitRate;

    m.symbols = table.size();
    return m;
}

static void writeRow(std::ofstream& out, const CacheMetrics& m) {
    out << m.dataset << "," << (m.cacheEnabled ? "cache-on" : "cache-off") << "," << m.symbols << ","
        << m.insert_us << "," << m.cold_lookup_us << "," << m.repeated_lookup_us << ","
        << m.cache_hit_rate << "," << m.speedup_vs_no_cache_x << "\n";
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

    std::ofstream out("results/cache_benchmark_results.csv");
    if (!out) {
        std::cerr << "ERROR: could not open results/cache_benchmark_results.csv (run from repo root)\n";
        return 1;
    }
    out << "dataset,variant,symbols,insert_us,cold_lookup_us,repeated_lookup_us,"
           "cache_hit_rate,speedup_vs_no_cache_x\n";

    for (auto& ds : datasets) {
        CacheMetrics off = runVariant(ds, false);
        CacheMetrics on = runVariant(ds, true);
        on.speedup_vs_no_cache_x = on.repeated_lookup_us > 0.0
            ? off.repeated_lookup_us / on.repeated_lookup_us : 0.0;
        off.speedup_vs_no_cache_x = 1.0;

        writeRow(out, off);
        writeRow(out, on);

        std::cout << ds.name << ": cache-off repeated=" << off.repeated_lookup_us
                  << "us/lookup, cache-on repeated=" << on.repeated_lookup_us
                  << "us/lookup (" << on.speedup_vs_no_cache_x << "x), hit_rate="
                  << on.cache_hit_rate << ", cold(off)=" << off.cold_lookup_us
                  << "us cold(on)=" << on.cold_lookup_us << "us\n";
    }

    out.close();
    std::cout << "\nWrote results/cache_benchmark_results.csv\n";
    return 0;
}
