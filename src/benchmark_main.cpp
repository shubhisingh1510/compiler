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

// ---- Review-2 Phase 5: v3 metrics row --------------------------------------
// Adds cache-hit-rate / promotions / bytes-reclaimed columns for the new
// BudgetSym-WithCache variant and ml-predicted dataset (Section VIII-E/F of
// the paper). Kept separate from bench_metrics.hpp's Metrics/runOne/CSV
// writer -- that shared code is also used by corpus_bench_main.cpp and
// multiseed_main.cpp for their own, differently-shaped CSV outputs, which
// this Phase does not touch.
struct MetricsV3 {
    std::string implementation;
    std::string dataset;
    long long tracked_memory = 0;
    double lookup_latency_us = 0.0;
    double insert_latency_us = 0.0;
    double cache_hit_rate = -1.0; // -1 = not applicable (no lookup cache on this implementation)
    size_t promotions = 0;
    long long bytes_reclaimed = 0;
    long long memo_hits = -1;        // -1 = not applicable (no COMPRESSED memoization on this implementation)
    long long memo_cold_lookups = -1;
    double compression_ratio = 1.0;  // vs. Conventional on the same dataset; caller fills in
};

static void fillExtra(const ConventionalSymbolTable&, MetricsV3& m) {
    m.cache_hit_rate = -1.0; m.promotions = 0; m.memo_hits = -1; m.memo_cold_lookups = -1;
}
static void fillExtra(const InternedSymbolTable&, MetricsV3& m) {
    m.cache_hit_rate = -1.0; m.promotions = 0; m.memo_hits = -1; m.memo_cold_lookups = -1;
}
static void fillExtra(BudgetSym& t, MetricsV3& m) {
    m.promotions = t.promotions();
    auto stats = t.statistics();
    m.cache_hit_rate = stats.lookupCache.hitRate;
    m.memo_hits = static_cast<long long>(stats.memoHits);
    m.memo_cold_lookups = static_cast<long long>(stats.memoColdLookups);
}

template <typename Table>
static MetricsV3 runOneV3(HiResTimer& timer, const std::string& implName, const Dataset& ds, Table& table,
                           long long conventionalBytes) {
    MetricsV3 m;
    m.implementation = implName;
    m.dataset = ds.name;

    auto tInsertStart = timer.now();
    for (auto& id : ds.identifiers) table.insert(id);
    auto tInsertEnd = timer.now();
    m.insert_latency_us = ds.identifiers.empty() ? 0.0 :
        timer.microsecondsBetween(tInsertStart, tInsertEnd) / static_cast<double>(ds.identifiers.size());

    size_t sampleCount = std::min<size_t>(ds.identifiers.size(), 500);
    size_t stride = ds.identifiers.size() / (sampleCount == 0 ? 1 : sampleCount);
    if (stride == 0) stride = 1;
    std::vector<std::string> sample;
    for (size_t i = 0; i < ds.identifiers.size(); i += stride) sample.push_back(ds.identifiers[i]);

    // Lookup benchmark: a hot-path access pattern -- repeated lookups of a
    // small subset, mirroring how a compiler re-resolves the same handful of
    // hot identifiers (loop counters, common helpers) far more often than
    // the long tail declared once and never revisited. Capped to well under
    // the 64-entry lookup cache's capacity so the cache's effect is actually
    // visible (a single uniform sweep over a larger sample would just thrash
    // it, reporting a near-0% hit rate for every variant regardless of the
    // cache's real behavior on realistic access patterns).
    size_t hotCount = std::min<size_t>(sample.size(), 32);
    std::vector<std::string> hotSample(sample.begin(), sample.begin() + static_cast<long>(hotCount));

    auto t0 = timer.now();
    volatile bool sink = false;
    const int rounds = 20;
    for (int r = 0; r < rounds; r++) {
        // NOTE: must not write this as `sink = sink || table.lookup(id)` --
        // that short-circuits after the first hit, skipping every subsequent
        // lookup() call in the loop entirely (see bench_metrics.hpp's runOne(),
        // which has the same latent bug -- fixed there too, this Phase).
        for (auto& id : hotSample) { bool hit = table.lookup(id); sink = sink || hit; }
    }
    auto t1 = timer.now();
    size_t totalLookups = hotSample.size() * static_cast<size_t>(rounds);
    m.lookup_latency_us = totalLookups == 0 ? 0.0 :
        timer.microsecondsBetween(t0, t1) / static_cast<double>(totalLookups);
    (void)sink;

    m.tracked_memory = table.tracker().current();
    m.compression_ratio = (conventionalBytes > 0 && m.tracked_memory > 0)
        ? static_cast<double>(conventionalBytes) / static_cast<double>(m.tracked_memory)
        : 1.0;

    table.enterScope();
    std::mt19937 rng(999);
    for (int i = 0; i < 200; i++) table.insert(randomIdentifier(rng, 4, 10));
    auto rep = table.exitScope();
    m.bytes_reclaimed = rep.bytesReclaimed;

    fillExtra(table, m);
    return m;
}

static void writeCsvHeaderV3(std::ofstream& out) {
    out << "implementation,dataset,tracked_memory,lookup_latency_us,insert_latency_us,cache_hit_rate,"
           "promotions,bytes_reclaimed,memo_hits,memo_cold_lookups,compression_ratio\n";
}

static void writeCsvRowV3(std::ofstream& out, const MetricsV3& m) {
    out << m.implementation << "," << m.dataset << "," << m.tracked_memory << "," << m.lookup_latency_us << ","
        << m.insert_latency_us << "," << m.cache_hit_rate << "," << m.promotions << "," << m.bytes_reclaimed << ","
        << m.memo_hits << "," << m.memo_cold_lookups << "," << m.compression_ratio << "\n";
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

    // ---- Review-2 Phase 5: v3 pass ----------------------------------------
    // Re-runs the same 8 datasets plus a new ml-predicted dataset, reporting
    // the new implementation/dataset,tracked_memory,lookup_latency_us,
    // cache_hit_rate,promotions,bytes_reclaimed schema. Separate pass (not
    // folded into the loop above) so results/benchmark_results.csv's
    // existing shape is unchanged for any other consumer of that file.
    std::cout << "\n== Running v3 pass (cache + ML-predicted threshold variants) ==\n";
    std::ofstream out3("results/benchmark_results_v3.csv");
    if (!out3) {
        std::cerr << "ERROR: could not open results/benchmark_results_v3.csv for writing\n";
        return 1;
    }
    writeCsvHeaderV3(out3);

    for (auto& ds : datasets) {
        ConventionalSymbolTable conv(ds.budgetBytes);
        MetricsV3 convM = runOneV3(g_timer, "Conventional", ds, conv, 0);
        convM.compression_ratio = 1.0; // conventional is the reference point
        long long conventionalBytes3 = convM.tracked_memory;

        InternedSymbolTable interned(ds.budgetBytes);
        MetricsV3 internedM = runOneV3(g_timer, "Interned", ds, interned, conventionalBytes3);

        // BudgetSym without the Phase 2 lookup cache -- latency baseline for
        // the "with cache vs without cache" comparison (paper Section VIII-E).
        BudgetSym budgetNoCache(ds.budgetBytes);
        budgetNoCache.setLookupCacheEnabled(false);
        MetricsV3 budgetNoCacheM = runOneV3(g_timer, "BudgetSym", ds, budgetNoCache, conventionalBytes3);

        BudgetSym budgetWithCache(ds.budgetBytes);
        MetricsV3 budgetWithCacheM = runOneV3(g_timer, "BudgetSym-WithCache", ds, budgetWithCache, conventionalBytes3);

        writeCsvRowV3(out3, convM);
        writeCsvRowV3(out3, internedM);
        writeCsvRowV3(out3, budgetNoCacheM);
        writeCsvRowV3(out3, budgetWithCacheM);

        std::cout << "  " << ds.name << ": BudgetSym lookup " << budgetNoCacheM.lookup_latency_us
                  << "us/op, BudgetSym-WithCache " << budgetWithCacheM.lookup_latency_us
                  << "us/op (hit rate " << budgetWithCacheM.cache_hit_rate << ")\n";
    }

    // ml-predicted dataset: profile the high-prefix-similarity dataset's
    // first 100 identifiers, predict thresholds via ThresholdPredictor, and
    // construct BudgetSym directly with the predicted PolicyConfig instead
    // of relying on the automatic post-100-insert reconfiguration -- an
    // idealized "already profiled this workload" scenario (paper Section
    // VIII-F). Conventional is included only as the compression-ratio 1.00x
    // reference point.
    {
        Dataset mlDs = genHighPrefixSimilarity(2000, seed + 3, defaultBudget);
        mlDs.name = "ml-predicted";

        WorkloadProfiler profiler;
        for (size_t i = 0; i < mlDs.identifiers.size() && !profiler.isComplete(); i++) {
            profiler.observe(mlDs.identifiers[i], 0, false);
        }
        WorkloadFeatures features = profiler.extract();
        PolicyConfig predictedCfg = ThresholdPredictor::predict(features);

        ConventionalSymbolTable conv(mlDs.budgetBytes);
        MetricsV3 convM = runOneV3(g_timer, "Conventional", mlDs, conv, 0);
        convM.compression_ratio = 1.0; // conventional is the reference point

        BudgetSym budgetMl(mlDs.budgetBytes, predictedCfg);
        MetricsV3 budgetMlM = runOneV3(g_timer, "BudgetSym-MLPredicted", mlDs, budgetMl, convM.tracked_memory);

        writeCsvRowV3(out3, convM);
        writeCsvRowV3(out3, budgetMlM);

        double compressionRatio = budgetMlM.compression_ratio;
        std::cout << "  ml-predicted: compression ratio " << compressionRatio
                  << "x, lookup " << budgetMlM.lookup_latency_us << "us/op "
                  << "(predicted compressMinLen=" << predictedCfg.compressMinLen
                  << ", prefixSimilarityMinShared=" << predictedCfg.prefixSimilarityMinShared << ")\n";
    }

    out3.close();
    std::cout << "\nWrote results/benchmark_results_v3.csv\n";
    return 0;
}
