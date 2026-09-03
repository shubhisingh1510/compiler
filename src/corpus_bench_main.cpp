// Real-world corpus evaluation harness (Review-2 Step 3). Replays an
// identifier stream extracted from real embedded-C source (via
// scripts/extract_identifiers.py) through Conventional/Interned/BudgetSym
// using the exact same runOne()/CSV schema as benchmark_main.cpp, so a
// corpus row is directly comparable to a synthetic-dataset row.
//
// Usage: ./corpus_bench.exe <identifiers_file> <corpus_name> [budget_bytes]
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include "../include/conventional_symbol_table.hpp"
#include "../include/interned_symbol_table.hpp"
#include "../include/budget_sym.hpp"
#include "../include/dataset_generators.hpp"
#include "../include/bench_metrics.hpp"

using namespace budgetsym;
static HiResTimer g_timer;

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Usage: " << (argc > 0 ? argv[0] : "corpus_bench.exe")
                  << " <identifiers_file> <corpus_name> [budget_bytes]\n";
        return 1;
    }
    std::string idFile = argv[1];
    std::string corpusName = argv[2];
    // Same generous default as benchmark_main.cpp's non-memory-stress datasets:
    // real identifier streams here are not meant to exercise the tiny-budget
    // eviction path, so keep pressure() near 0 unless the caller overrides it.
    size_t budgetBytes = 64ull * 1024 * 1024;
    if (argc >= 4) {
        budgetBytes = static_cast<size_t>(std::stoull(argv[3]));
    }

    std::ifstream in(idFile.c_str());
    if (!in) {
        std::cerr << "ERROR: identifiers file '" << idFile << "' not found or empty -- "
                     "run scripts/extract_identifiers.py first, or see docs/corpus_setup.md\n";
        return 1;
    }

    Dataset ds;
    ds.name = corpusName;
    ds.budgetBytes = budgetBytes;
    std::string line;
    while (std::getline(in, line)) {
        // Strip trailing CR in case the file was produced/edited on Windows.
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue; // skip blank lines
        ds.identifiers.push_back(line);
    }
    in.close();

    if (ds.identifiers.empty()) {
        std::cerr << "ERROR: identifiers file '" << idFile << "' not found or empty -- "
                     "run scripts/extract_identifiers.py first, or see docs/corpus_setup.md\n";
        return 1;
    }

    std::cout << "Running corpus: " << ds.name << " (" << ds.identifiers.size()
              << " identifiers, budget=" << ds.budgetBytes << " bytes)\n";

    ConventionalSymbolTable conv(ds.budgetBytes);
    Metrics convM = runOne(g_timer, "Conventional", ds, conv, 0);
    convM.compression_ratio = 1.0; // conventional is the reference point
    long long conventionalBytes = convM.memory_bytes;

    InternedSymbolTable interned(ds.budgetBytes);
    Metrics internedM = runOne(g_timer, "Interned", ds, interned, conventionalBytes);

    BudgetSym budgetSym(ds.budgetBytes);
    Metrics budgetM = runOne(g_timer, "BudgetSym", ds, budgetSym, conventionalBytes);

    // Append mode: this binary runs once per corpus (freertos, arduino-core,
    // zephyr, ...) via build.sh's corpus block, and each invocation must add
    // its 3 rows without clobbering rows already written by earlier corpora.
    // Header is written only when the file doesn't exist yet.
    std::string csvPath = "results/corpus_results.csv";
    std::ifstream existsCheck(csvPath.c_str());
    bool needsHeader = !existsCheck.good();
    existsCheck.close();

    std::ofstream out(csvPath.c_str(), std::ios::app);
    if (!out) {
        std::cerr << "ERROR: could not open " << csvPath << " for writing "
                     "(run this binary from the repo root so results/ resolves)\n";
        return 1;
    }
    if (needsHeader) writeCsvHeader(out);

    writeCsvRow(out, convM);
    writeCsvRow(out, internedM);
    writeCsvRow(out, budgetM);
    out.close();

    std::cout << "  Conventional: " << convM.memory_bytes << " bytes tracked, "
              << conv.size() << " symbols\n";
    std::cout << "  Interned:     " << internedM.memory_bytes << " bytes tracked ("
              << internedM.compression_ratio << "x vs conventional)\n";
    std::cout << "  BudgetSym:    " << budgetM.memory_bytes << " bytes tracked ("
              << budgetM.compression_ratio << "x vs conventional), "
              << budgetSym.promotions() << " promotions\n";
    std::cout << "\nAppended 3 rows to " << csvPath << "\n";
    return 0;
}
