// Minimal correctness smoke test for all three symbol tables + the adaptive
// mechanism. Not a full unit-test framework (none is available in this
// toolchain) -- asserts + a PASS/FAIL summary, run from build.sh.
#include <cassert>
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
