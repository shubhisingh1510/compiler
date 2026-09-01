// Lightweight ablation study, run tonight rather than deferred to "future
// work": compares BudgetSym-Full against three variants, each disabling one
// mechanism, on the same fixed workload. All four variants run the real
// BudgetSym implementation with different PolicyConfig / harness settings --
// no separate reimplementation, so this measures the actual mechanisms, not
// stand-ins for them.
//
//   BudgetSym-Full               : default policy, scopes reclaimed, promotion active
//   BudgetSym-NoScope            : same policy, but scopes are NEVER exited (no reclamation)
//   BudgetSym-NoAccessFrequency  : hotAccessThreshold set unreachably high -> promotion never fires,
//                                  "hot" bias in decide() never applies
//   BudgetSym-NoAdaptiveSelection: decide() disabled, every symbol forced to INTERNED_REP
//                                  (this is what plain string interning would have done)
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <vector>
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
    for (int i = 0; i < len; i++) s += alpha[chDist(rng)];
    return s;
}

// Fixed workload shared by every variant: a mix of prefix-similar long names
// (compression-favorable) and short random ones, inserted across 30 nested
// scopes, with a "hot" subset re-accessed repeatedly.
struct Workload {
    std::vector<std::string> perScopeInserts[30];
    std::vector<std::string> hotNames;
};

static Workload buildWorkload() {
    Workload w;
    std::mt19937 rng(777);
    static const char* prefixes[] = {
        "moduleConfigParameter", "temperatureSensorCalibration", "networkInterfaceBuffer"
    };
    int counter = 0;
    for (int s = 0; s < 30; s++) {
        // A contiguous run of 5 long, prefix-similar identifiers at the start
        // of each scope (compression-favorable: each shares a long prefix
        // with the one immediately before it, which is what decide()'s
        // similarity signal actually checks). Scope 0's run is also recorded
        // as the "hot" set the ablation re-accesses.
        for (int k = 0; k < 5; k++) {
            std::string name = std::string(prefixes[s % 3]) + std::to_string(counter++);
            w.perScopeInserts[s].push_back(name);
            if (s == 0) w.hotNames.push_back(name);
        }
        for (int i = 0; i < 35; i++) w.perScopeInserts[s].push_back(randomIdentifier(rng, 4, 12));
    }
    return w;
}

struct AblationResult {
    std::string variant;
    size_t symbols = 0;
    long long memory_bytes = 0;
    double memory_per_symbol = 0.0;
    size_t promotions = 0;
    double insert_us = 0.0;
    double lookup_us = 0.0;
    long long bytes_reclaimed_total = 0;
};

static AblationResult runVariant(const std::string& variantName, PolicyConfig cfg,
                                  bool exerciseScopes, const Workload& w) {
    AblationResult r; r.variant = variantName;
    BudgetSym table(64ull * 1024 * 1024, cfg);

    size_t totalInserted = 0;
    auto t0 = g_timer.now();
    for (int s = 0; s < 30; s++) {
        table.enterScope();
        for (auto& n : w.perScopeInserts[s]) { table.insert(n); totalInserted++; }
        if (exerciseScopes && s % 3 == 2) { // exit most scopes as we go, like real block scoping
            auto rep = table.exitScope();
            r.bytes_reclaimed_total += rep.bytesReclaimed;
        }
    }
    auto t1 = g_timer.now();
    r.insert_us = g_timer.microsecondsBetween(t0, t1) / static_cast<double>(totalInserted);

    // repeatedly access the "hot" subset -- this is what should trigger
    // promotion in BudgetSym-Full but not in BudgetSym-NoAccessFrequency
    auto t2 = g_timer.now();
    size_t lookups = 0;
    for (int rpt = 0; rpt < 5; rpt++) {
        for (auto& n : w.hotNames) { table.lookup(n); lookups++; }
    }
    auto t3 = g_timer.now();
    r.lookup_us = g_timer.microsecondsBetween(t2, t3) / static_cast<double>(lookups);

    r.symbols = table.size();
    r.memory_bytes = table.tracker().current();
    r.memory_per_symbol = r.symbols > 0 ? static_cast<double>(r.memory_bytes) / static_cast<double>(r.symbols) : 0.0;
    r.promotions = table.promotions();
    return r;
}

int main() {
    Workload w = buildWorkload();
    std::vector<AblationResult> results;

    // Full: default policy, scopes actually exited, promotion active.
    results.push_back(runVariant("BudgetSym-Full", PolicyConfig(), /*exerciseScopes=*/true, w));

    // NoScope: same policy, but never call exitScope() -- nothing is ever reclaimed.
    results.push_back(runVariant("BudgetSym-NoScope", PolicyConfig(), /*exerciseScopes=*/false, w));

    // NoAccessFrequency: promotion / hot-bias effectively disabled by making
    // the hot threshold unreachable.
    {
        PolicyConfig cfg;
        cfg.hotAccessThreshold = static_cast<size_t>(-1); // SIZE_MAX: never "hot"
        results.push_back(runVariant("BudgetSym-NoAccessFrequency", cfg, true, w));
    }

    // NoAdaptiveSelection: decide() bypassed entirely, every symbol forced to
    // INTERNED_REP -- this collapses to what plain string interning would do.
    {
        PolicyConfig cfg;
        cfg.disableAdaptiveSelection = true;
        cfg.fixedRepresentation = Representation::INTERNED_REP;
        results.push_back(runVariant("BudgetSym-NoAdaptiveSelection", cfg, true, w));
    }

    std::ofstream out("results/ablation_results.csv");
    if (!out) { std::cerr << "ERROR: could not open results/ablation_results.csv\n"; return 1; }
    out << "variant,symbols,memory_bytes,memory_per_symbol,promotions,insert_us,lookup_us,bytes_reclaimed_total\n";
    for (auto& r : results) {
        out << r.variant << "," << r.symbols << "," << r.memory_bytes << "," << r.memory_per_symbol << ","
            << r.promotions << "," << r.insert_us << "," << r.lookup_us << "," << r.bytes_reclaimed_total << "\n";
        std::cout << r.variant << ": " << r.memory_bytes << " bytes tracked, "
                  << r.symbols << " live symbols, " << r.promotions << " promotions, "
                  << r.bytes_reclaimed_total << " bytes reclaimed via scope exits\n";
    }
    out.close();
    std::cout << "\nWrote results/ablation_results.csv\n";
    return 0;
}
