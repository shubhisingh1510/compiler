#pragma once
// Timed-operation runner and CSV writer shared by benchmark_main.cpp,
// corpus_bench_main.cpp and multiseed_main.cpp. Extracted from the original
// benchmark_main.cpp (Review-1) so all three tools measure/report identically.
#include <algorithm>
#include <fstream>
#include <random>
#include <string>
#include "dataset_generators.hpp"
#include "hires_timer.hpp"

namespace budgetsym {

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
inline Metrics runOne(HiResTimer& g_timer, const std::string& implName, const Dataset& ds, Table& table,
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

inline void writeCsvHeader(std::ofstream& out) {
    out << "dataset,implementation,symbols,memory_bytes,memory_per_symbol,compression_ratio,"
           "insert_us,lookup_success_us,lookup_failure_us,scope_enter_us,scope_exit_us\n";
}

inline void writeCsvRow(std::ofstream& out, const Metrics& m) {
    out << m.dataset << "," << m.impl << "," << m.symbols << "," << m.memory_bytes << ","
        << m.memory_per_symbol << "," << m.compression_ratio << "," << m.insert_us << ","
        << m.lookup_success_us << "," << m.lookup_failure_us << "," << m.scope_enter_us << ","
        << m.scope_exit_us << "\n";
}

} // namespace budgetsym
