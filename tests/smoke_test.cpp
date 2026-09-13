// Minimal correctness smoke test for all three symbol tables + the adaptive
// mechanism. Not a full unit-test framework (none is available in this
// toolchain) -- asserts + a PASS/FAIL summary, run from build.sh.
#include <cassert>
#include <cmath>
#include <iostream>
#include <string>
#include "../include/conventional_symbol_table.hpp"
#include "../include/interned_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"
#include "../include/bench_metrics.hpp"

using namespace budgetsym;

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; failures++; } } while (0)

void test_conventional() {
    ConventionalSymbolTable t(1 << 20);
    t.insert("x");
    t.insert("y");
    CHECK(t.lookup("x"));
    CHECK(t.lookup("y"));
    CHECK(!t.lookup("z"));
    t.enterScope();
    t.insert("x"); // shadow
    t.insert("local1");
    CHECK(t.lookup("local1"));
    auto rep = t.exitScope();
    CHECK(rep.symbolsReleased == 2);
    CHECK(!t.lookup("local1"));
    CHECK(t.lookup("x")); // outer x still visible
}

void test_interned() {
    InternedSymbolTable t(1 << 20);
    t.insert("counter");
    t.insert("counter"); // repeat -> shared pool entry
    CHECK(t.lookup("counter"));
    long long before = t.tracker().current();
    t.enterScope();
    t.insert("counter");
    t.insert("temp");
    CHECK(t.lookup("temp"));
    auto rep = t.exitScope();
    CHECK(rep.symbolsReleased == 2);
    CHECK(!t.lookup("temp"));
    CHECK(t.lookup("counter"));
    long long after = t.tracker().current();
    CHECK(after == before); // scope-local refs to "counter" reclaimed, pool entry itself untouched
}

void test_budgetsym_basic() {
    BudgetSym t(1 << 20);
    t.insert("i");
    t.insert("index");
    t.insert("temperatureThresholdValue");
    CHECK(t.lookup("i"));
    CHECK(t.lookup("index"));
    CHECK(t.lookup("temperatureThresholdValue"));
    CHECK(!t.lookup("doesNotExist"));
}

void test_budgetsym_scope_reclaim() {
    BudgetSym t(1 << 20);
    t.insert("global1");
    t.enterScope();
    for (int i = 0; i < 20; i++) t.insert("nested_local_" + std::to_string(i));
    long long peak = t.tracker().current();
    auto rep = t.exitScope();
    CHECK(rep.symbolsReleased == 20);
    CHECK(rep.bytesReclaimed > 0);
    CHECK(t.tracker().current() < peak);
    CHECK(t.lookup("global1"));
    CHECK(!t.lookup("nested_local_5"));
}

void test_budgetsym_compression_roundtrip() {
    BudgetSym t(1 << 20);
    PolicyConfig cfg = t.config();
    // Force a run of long, prefix-similar identifiers so they get compressed.
    std::vector<std::string> names = {
        "temperatureSensorReading", "temperatureSensorOffset", "temperatureSensorCalibration",
        "temperatureSensorMaxValue", "temperatureSensorMinValue"
    };
    for (auto& n : names) t.insert(n, 0, 0);
    for (auto& n : names) CHECK(t.lookup(n)); // every compressed entry must decode back correctly
    (void)cfg;
}

void test_budgetsym_promotion() {
    PolicyConfig cfg;
    cfg.hotAccessThreshold = 2;
    BudgetSym t(1 << 20, cfg);
    t.insert("veryLongPrefixSimilarIdentifierAlpha");
    t.insert("veryLongPrefixSimilarIdentifierBeta"); // should compress against the first
    auto repBefore = t.representationOf("veryLongPrefixSimilarIdentifierBeta");
    CHECK(repBefore == Representation::COMPRESSED_REP);
    t.lookup("veryLongPrefixSimilarIdentifierBeta");
    t.lookup("veryLongPrefixSimilarIdentifierBeta"); // crosses hotAccessThreshold=2
    auto repAfter = t.representationOf("veryLongPrefixSimilarIdentifierBeta");
    CHECK(repAfter == Representation::INTERNED_REP);
    CHECK(t.promotions() == 1);
    CHECK(t.lookup("veryLongPrefixSimilarIdentifierBeta")); // still findable after promotion
}

// Review-2 addition: per-entry memoized COMPRESSED reconstruction (Phase 1).
// Uses representationOf() rather than lookup() to exercise reconstructFull()
// in isolation -- lookup() also goes through the Phase 2 LRU cache (see
// test_budgetsym_lookup_cache_hit_rate below), which would otherwise short-
// circuit repeat queries before they ever reach the memoized chain walk.
void test_budgetsym_memo_reconstruction() {
    BudgetSym t(1 << 20);
    // Force all three into the same COMPRESSED chain.
    t.insert("temperatureSensorReadingAlpha", 0, 0);
    t.insert("temperatureSensorReadingBeta", 0, 0);
    t.insert("temperatureSensorReadingGamma", 0, 0);
    for (int i = 0; i < 5; i++) {
        CHECK(t.representationOf("temperatureSensorReadingGamma") == Representation::COMPRESSED_REP);
    }
    auto stats = t.statistics();
    CHECK(stats.memoColdLookups == 1);
    CHECK(stats.memoHits == 4);
}

// Review-2 addition: LRU lookup cache (Phase 2).
void test_budgetsym_lookup_cache_hit_rate() {
    BudgetSym t(1 << 20);
    for (int i = 0; i < 10; i++) t.insert("cachedSymbol" + std::to_string(i));
    for (int i = 0; i < 20; i++) CHECK(t.lookup("cachedSymbol0")); // 1 cold miss + 19 hits
    auto stats = t.statistics();
    CHECK(stats.lookupCache.hitRate > 0.9);
}

void test_budgetsym_lookup_cache_invalidation_on_scope_exit() {
    BudgetSym t(1 << 20);
    t.enterScope();
    t.insert("scopedTemp");
    CHECK(t.lookup("scopedTemp"));  // populates the cache
    CHECK(t.statistics().lookupCache.hits + t.statistics().lookupCache.misses > 0);
    t.exitScope();
    CHECK(!t.lookup("scopedTemp")); // must not resurrect a reclaimed symbol via a stale cache entry
}

// Review-2 addition: WorkloadProfiler (Phase 3).
void test_workload_profiler_mean_name_length() {
    BudgetSym t(1 << 20);
    // 120 distinct 10-char identifiers -> expected meanNameLength == 10.0.
    for (int i = 0; i < 120; i++) {
        std::string n = "sym" + std::string(7 - std::to_string(i).size(), '0') + std::to_string(i);
        t.insert(n); // "sym" + 7 digits = 10 chars, always distinct
    }
    CHECK(t.profiler().isComplete());
    WorkloadFeatures f = t.profiler().extract();
    CHECK(std::abs(f.meanNameLength - 10.0) < 1.0); // within 10%
}

// Review-2 addition: ML-driven threshold prediction (Phase 4).
void test_threshold_predictor_aggressive_compression_for_high_prefix_workload() {
    WorkloadProfiler profiler;
    for (int i = 0; i < 100; i++) {
        profiler.observe("temperature" + std::to_string(i), 0, false);
    }
    CHECK(profiler.isComplete());
    WorkloadFeatures f = profiler.extract();
    PolicyConfig predicted = ThresholdPredictor::predict(f);
    CHECK(predicted.compressMinLen <= 8);
    CHECK(predicted.prefixSimilarityMinShared <= 3);
}

// End-to-end: BudgetSym itself reconfigures cfg_ once the 100-symbol
// profiling window fills, without any explicit predictor call from the caller.
void test_budgetsym_applies_predicted_thresholds_after_profiling_window() {
    BudgetSym t(1 << 20);
    PolicyConfig before = t.config();
    for (int i = 0; i < 100; i++) t.insert("temperature" + std::to_string(i));
    CHECK(t.profiler().isComplete());
    PolicyConfig after = t.config();
    CHECK(after.compressMinLen != before.compressMinLen || after.prefixSimilarityMinShared != before.prefixSimilarityMinShared);
}

// Review-2 fix: disableMLThresholdPrediction actually holds cfg_ fixed past
// the 100-symbol profiling window (needed so grid_search_main.cpp's swept
// configs, and ablation_main.cpp's NoAccessFrequency variant, aren't silently
// overwritten mid-run by the Phase 4 auto-ML-override).
void test_disable_ml_threshold_prediction_holds_config_fixed() {
    PolicyConfig cfg;
    cfg.hotAccessThreshold = 999; // deliberately distinctive, unlikely to be a predicted value
    cfg.disableMLThresholdPrediction = true;
    BudgetSym t(1 << 20, cfg);
    for (int i = 0; i < 150; i++) t.insert("sym" + std::to_string(i));
    CHECK(t.profiler().isComplete());
    CHECK(t.config().hotAccessThreshold == 999);
}

void test_budgetsym_memory_pressure_selects_compressed() {
    PolicyConfig cfg;
    cfg.highPressureThreshold = 0.0; // force "always high pressure" for this test
    cfg.compressMinLen = 5;
    BudgetSym t(1, cfg); // tiny budget -> pressure() clamps to 1.0 immediately
    int id = t.insert("longIdentifierName", 0, 0);
    (void)id;
    CHECK(t.representationOf("longIdentifierName") == Representation::COMPRESSED_REP);
}

// Review-2 additions: dataset_generators.hpp / bench_metrics.hpp were
// factored out of benchmark_main.cpp so grid_search/multiseed/corpus_bench
// can reuse them -- these checks guard the determinism the whole sweep
// infrastructure depends on.
void test_dataset_generators_deterministic() {
    Dataset a = genUniformRandom("x", 50, 4, 10, 7, 1 << 20);
    Dataset b = genUniformRandom("x", 50, 4, 10, 7, 1 << 20);
    CHECK(a.identifiers == b.identifiers); // same seed -> identical output
    CHECK(a.identifiers.size() == 50);

    // genHighPrefixSimilarity ignores its seed param by design (kept
    // byte-identical to Review-1 benchmark_main.cpp); the seeded sibling
    // must actually vary so multiseed.exe's 30 seeds aren't degenerate.
    Dataset p1 = genHighPrefixSimilaritySeeded(20, 1, 1 << 20);
    Dataset p2 = genHighPrefixSimilaritySeeded(20, 2, 1 << 20);
    CHECK(p1.identifiers != p2.identifiers);
    CHECK(p1.identifiers.size() == 20);
}

void test_bench_metrics_compression_ratio() {
    HiResTimer timer;
    Dataset ds = genUniformRandom("y", 30, 6, 14, 3, 1 << 20);
    ConventionalSymbolTable conv(ds.budgetBytes);
    Metrics convM = runOne(timer, "Conventional", ds, conv, 0);
    BudgetSym budget(ds.budgetBytes);
    Metrics budgetM = runOne(timer, "BudgetSym", ds, budget, convM.memory_bytes);
    CHECK(budgetM.compression_ratio > 0.0);
    CHECK(budgetM.symbols == ds.identifiers.size() || budgetM.symbols <= ds.identifiers.size());
}

int main() {
    test_conventional();
    test_interned();
    test_budgetsym_basic();
    test_budgetsym_scope_reclaim();
    test_budgetsym_compression_roundtrip();
    test_budgetsym_promotion();
    test_budgetsym_memo_reconstruction();
    test_budgetsym_lookup_cache_hit_rate();
    test_budgetsym_lookup_cache_invalidation_on_scope_exit();
    test_workload_profiler_mean_name_length();
    test_threshold_predictor_aggressive_compression_for_high_prefix_workload();
    test_budgetsym_applies_predicted_thresholds_after_profiling_window();
    test_disable_ml_threshold_prediction_holds_config_fixed();
    test_budgetsym_memory_pressure_selects_compressed();
    test_dataset_generators_deterministic();
    test_bench_metrics_compression_ratio();

    if (failures == 0) {
        std::cout << "ALL TESTS PASSED\n";
        return 0;
    } else {
        std::cout << failures << " TEST(S) FAILED\n";
        return 1;
    }
}
