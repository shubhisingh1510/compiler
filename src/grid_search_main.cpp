// Grid-search over BudgetSym's 6 PolicyConfig thresholds (Review-2 paper
// claim #1). Builds the same 8 datasets as benchmark_main.cpp once, then for
// each of 15,000 threshold combinations runs an insert-only BudgetSym pass
// per dataset (no lookup/scope timing -- only memoryUsage()-derived
// compression ratio matters here) and tracks the best mean compression ratio
// found. Never adopts the result into common.hpp defaults or
// benchmark_results.csv -- that is a separate, later decision.
#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include "../include/conventional_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"

using namespace budgetsym;

static double compressionRatioFor(const Dataset& ds, const PolicyConfig& cfg, long long conventionalBytes) {
    BudgetSym table(ds.budgetBytes, cfg);
    for (auto& id : ds.identifiers) table.insert(id);
    long long bytes = table.tracker().current();
    return bytes > 0 && conventionalBytes > 0
        ? static_cast<double>(conventionalBytes) / static_cast<double>(bytes)
        : 1.0;
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

    std::vector<long long> conventionalBytes(datasets.size());
    for (size_t i = 0; i < datasets.size(); i++) {
        ConventionalSymbolTable conv(datasets[i].budgetBytes);
        for (auto& id : datasets[i].identifiers) conv.insert(id);
        conventionalBytes[i] = conv.tracker().current();
    }

    static const size_t inlineMaxLenVals[] = {6, 8, 10, 12, 14, 16};
    static const size_t compressMinLenVals[] = {6, 8, 10, 12, 14};
    static const double lowPressureThresholdVals[] = {0.30, 0.40, 0.50, 0.60};
    static const double highPressureThresholdVals[] = {0.70, 0.75, 0.80, 0.85, 0.90};
    static const size_t hotAccessThresholdVals[] = {2, 3, 4, 5, 6};
    static const size_t prefixSimilarityMinSharedVals[] = {2, 3, 4, 5, 6};

    const size_t totalConfigs =
        (sizeof(inlineMaxLenVals) / sizeof(size_t)) *
        (sizeof(compressMinLenVals) / sizeof(size_t)) *
        (sizeof(lowPressureThresholdVals) / sizeof(double)) *
        (sizeof(highPressureThresholdVals) / sizeof(double)) *
        (sizeof(hotAccessThresholdVals) / sizeof(size_t)) *
        (sizeof(prefixSimilarityMinSharedVals) / sizeof(size_t));

    std::cout << "Grid search: " << totalConfigs << " configs over " << datasets.size() << " datasets\n";

    std::ostringstream csv;
    csv << "inlineMaxLen,compressMinLen,lowPressureThreshold,highPressureThreshold,hotAccessThreshold,"
           "prefixSimilarityMinShared,mean_compression_ratio";
    for (auto& ds : datasets) csv << "," << ds.name << "_ratio";
    csv << "\n";

    PolicyConfig bestCfg;
    double bestRatio = -1.0;
    size_t count = 0;
    std::vector<double> ratios(datasets.size());

    for (size_t a = 0; a < 6; a++) {
        for (size_t b = 0; b < 5; b++) {
            for (size_t c = 0; c < 4; c++) {
                for (size_t d = 0; d < 5; d++) {
                    for (size_t e = 0; e < 5; e++) {
                        for (size_t f = 0; f < 5; f++) {
                            PolicyConfig cfg;
                            cfg.inlineMaxLen = inlineMaxLenVals[a];
                            cfg.compressMinLen = compressMinLenVals[b];
                            cfg.lowPressureThreshold = lowPressureThresholdVals[c];
                            cfg.highPressureThreshold = highPressureThresholdVals[d];
                            cfg.hotAccessThreshold = hotAccessThresholdVals[e];
                            cfg.prefixSimilarityMinShared = prefixSimilarityMinSharedVals[f];

                            double sum = 0.0;
                            for (size_t i = 0; i < datasets.size(); i++) {
                                double r = compressionRatioFor(datasets[i], cfg, conventionalBytes[i]);
                                ratios[i] = r;
                                sum += r;
                            }
                            double meanRatio = sum / static_cast<double>(datasets.size());

                            csv << cfg.inlineMaxLen << "," << cfg.compressMinLen << ","
                                << cfg.lowPressureThreshold << "," << cfg.highPressureThreshold << ","
                                << cfg.hotAccessThreshold << "," << cfg.prefixSimilarityMinShared << ","
                                << meanRatio;
                            for (size_t i = 0; i < ratios.size(); i++) csv << "," << ratios[i];
                            csv << "\n";

                            if (meanRatio > bestRatio) {
                                bestRatio = meanRatio;
                                bestCfg = cfg;
                            }

                            count++;
                            if (count % 1000 == 0) {
                                std::cout << "  " << count << "/" << totalConfigs
                                          << " configs done, best so far = " << bestRatio << "\n";
                            }
                        }
                    }
                }
            }
        }
    }

    std::ofstream fullOut("results/grid_search_full.csv");
    if (!fullOut) {
        std::cerr << "ERROR: could not open results/grid_search_full.csv for writing "
                     "(run this binary from the repo root so results/ resolves)\n";
        return 1;
    }
    fullOut.write(csv.str().data(), static_cast<std::streamsize>(csv.str().size())); // single buffered write: 15,000 individual << flushes dominate runtime otherwise
    fullOut.close();

    PolicyConfig handPicked; // common.hpp defaults
    double handPickedSum = 0.0;
    for (size_t i = 0; i < datasets.size(); i++) {
        handPickedSum += compressionRatioFor(datasets[i], handPicked, conventionalBytes[i]);
    }
    double handPickedRatio = handPickedSum / static_cast<double>(datasets.size());

    std::ofstream optOut("results/optimal_policy.csv");
    if (!optOut) {
        std::cerr << "ERROR: could not open results/optimal_policy.csv for writing\n";
        return 1;
    }
    optOut << "label,inlineMaxLen,compressMinLen,lowPressureThreshold,highPressureThreshold,"
              "hotAccessThreshold,prefixSimilarityMinShared,mean_compression_ratio\n";
    optOut << "hand_picked," << handPicked.inlineMaxLen << "," << handPicked.compressMinLen << ","
           << handPicked.lowPressureThreshold << "," << handPicked.highPressureThreshold << ","
           << handPicked.hotAccessThreshold << "," << handPicked.prefixSimilarityMinShared << ","
           << handPickedRatio << "\n";
    optOut << "grid_search_optimal," << bestCfg.inlineMaxLen << "," << bestCfg.compressMinLen << ","
           << bestCfg.lowPressureThreshold << "," << bestCfg.highPressureThreshold << ","
           << bestCfg.hotAccessThreshold << "," << bestCfg.prefixSimilarityMinShared << ","
           << bestRatio << "\n";
    optOut.close();

    std::cout << "\nWrote results/grid_search_full.csv (" << totalConfigs << " rows) and "
                 "results/optimal_policy.csv\n";
    std::cout << "Best config found: inlineMaxLen=" << bestCfg.inlineMaxLen
              << " compressMinLen=" << bestCfg.compressMinLen
              << " lowPressureThreshold=" << bestCfg.lowPressureThreshold
              << " highPressureThreshold=" << bestCfg.highPressureThreshold
              << " hotAccessThreshold=" << bestCfg.hotAccessThreshold
              << " prefixSimilarityMinShared=" << bestCfg.prefixSimilarityMinShared
              << " mean_compression_ratio=" << bestRatio << "\n";
    std::cout << "hand_picked mean_compression_ratio=" << handPickedRatio << "\n";

    std::cerr << "FYI: paper's Review-2 draft claims optimum region around inlineMaxLen=10, "
                 "compressMinLen=8, lowPressureThreshold=0.40, highPressureThreshold=0.80, "
                 "hotAccessThreshold=3, prefixSimilarityMinShared=3 (informational only, not asserted)\n";

    return 0;
}
