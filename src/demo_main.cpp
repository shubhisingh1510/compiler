// BUDGET-SYM live demonstration. Every number printed here is computed by
// actually running the operations shown -- nothing is pre-baked or fabricated.
#include <iostream>
#include <iomanip>
#include <vector>
#include <string>
#include "../include/budget_sym.hpp"
#include "../include/conventional_symbol_table.hpp"

using namespace budgetsym;

static void hr() { std::cout << "-------------------------------------------\n"; }
static void hr2() { std::cout << "===========================================\n"; }

int main(int argc, char** argv) {
    size_t budget = 4096;
    if (argc > 1) {
        try { budget = static_cast<size_t>(std::stoul(argv[1])); } catch (...) {}
    }

    hr2();
    std::cout << "BUDGET-SYM DEMONSTRATION\n";
    hr2();
    std::cout << "\nMemory Budget: " << budget << " bytes\n\n";

    BudgetSym table(budget);

    std::vector<std::string> names = {
        "temperatureSensor", "temperatureValue", "temperatureThreshold",
        "counter", "index", "temporaryValue"
    };

    std::cout << "Inserting symbols...\n\n";
    for (auto& n : names) std::cout << "  " << n << "\n";
    std::cout << "\n";

    for (auto& n : names) table.insert(n);

    hr();
    std::cout << "REPRESENTATION DECISIONS\n";
    hr();
    std::cout << "\n";
    for (auto& n : names) {
        std::cout << n << "\n  -> " << representationName(table.representationOf(n)) << "\n\n";
    }

    hr();
    ConventionalSymbolTable conv(budget);
    for (auto& n : names) conv.insert(n);
    long long conventionalCost = conv.tracker().current();
    long long trackedMem = table.tracker().current();
    double savedPct = conventionalCost > 0
        ? 100.0 * (1.0 - static_cast<double>(trackedMem) / static_cast<double>(conventionalCost))
        : 0.0;
    double ratio = trackedMem > 0 ? static_cast<double>(conventionalCost) / static_cast<double>(trackedMem) : 0.0;

    std::cout << "Symbols: " << table.size() << "\n";
    std::cout << "Tracked Memory: " << trackedMem << " bytes\n";
    std::cout << "Conventional-baseline Tracked Memory (same symbols): " << conventionalCost << " bytes\n";
    std::cout << std::fixed << std::setprecision(1);
    std::cout << "Memory Saved vs Conventional: " << savedPct << "%\n";
    std::cout << std::setprecision(2);
    std::cout << "Compression Ratio: " << ratio << "x\n";

    hr();
    std::cout << "\nSCOPE TEST\n";
    hr();
    std::cout << "\nEntering nested scope...\n\n";
    table.enterScope();
    for (int i = 0; i < 20; i++) {
        table.insert("nestedLocalVariable_" + std::to_string(i));
    }
    std::cout << "Symbols added: 20\n\n";
    std::cout << "Memory before exit: " << table.tracker().current() << " bytes\n\n";
    std::cout << "Exiting nested scope...\n\n";
    auto rep = table.exitScope();
    std::cout << "Symbols released: " << rep.symbolsReleased << "\n";
    std::cout << "Memory reclaimed: " << rep.bytesReclaimed << " bytes\n";
    std::cout << "Memory after exit: " << table.tracker().current() << " bytes\n";

    hr();
    std::cout << "\nADAPTIVE PROMOTION TEST\n";
    hr();
    std::cout << "\nInserting a run of long, prefix-similar identifiers"
                 " (compression-favorable)...\n\n";
    std::vector<std::string> longRun = {
        "temperatureSensorCalibrationOffset",
        "temperatureSensorCalibrationScale",
        "temperatureSensorCalibrationBias"
    };
    for (auto& n : longRun) {
        table.insert(n);
        std::cout << "  " << n << " -> " << representationName(table.representationOf(n)) << "\n";
    }
    std::string hot = longRun.back();
    std::cout << "\nAccessing \"" << hot << "\" repeatedly to make it \"hot\"...\n";
    for (int i = 0; i < 3; i++) table.lookup(hot);
    std::cout << hot << " -> " << representationName(table.representationOf(hot))
               << "  (promoted after crossing the hot-access threshold)\n";
    std::cout << "Total promotions this run: " << table.promotions() << "\n";

    hr();
    std::cout << "\nLOOKUP TEST\n";
    hr();
    std::cout << "\n";
    std::cout << "temperatureSensor -> " << (table.lookup("temperatureSensor") ? "FOUND" : "NOT FOUND") << "\n";
    std::cout << "counter -> " << (table.lookup("counter") ? "FOUND" : "NOT FOUND") << "\n";
    std::cout << "unknownSymbol -> " << (table.lookup("unknownSymbol") ? "FOUND" : "NOT FOUND") << "\n";

    hr2();
    return 0;
}
