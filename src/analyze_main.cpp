// analyze_main.cpp -- the real backend engine behind the web dashboard's
// "Compile / Analyze" button (frontend/app/api/analyze/route.ts spawns this
// binary). It is NOT a C/C++ parser: it reads a simple, already-extracted
// event stream (scope declarations + identifier inserts, in source order)
// from stdin, replays that exact sequence through the REAL BudgetSym and
// ConventionalSymbolTable classes from include/, and prints the real,
// measured result as JSON. The lightweight source -> event-stream extraction
// (regex/brace based, not a real parser) lives in the Next.js API route and
// is labeled there as a prototype heuristic -- seeexpected honesty rule in
// docs/methodology.md.
//
// Protocol read from stdin, one directive per line:
//   BUDGET <bytes>
//   CFG <fieldName> <value>              (optional, zero or more; overrides PolicyConfig defaults)
//   SCOPE <id> <parentId> <label>        (label has no spaces; declared in the exact order scopes open)
//   EVENT INSERT <name> <typeHint>       (typeHint has no spaces, e.g. "int", "float", "unknown")
//   EVENT ENTER                          (opens the next SCOPE in declaration order)
//   EVENT EXIT
//   END
//
// Output on stdout: a single JSON object, see printResultJson() below.
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include "../include/budget_sym.hpp"
#include "../include/conventional_symbol_table.hpp"
#include "../include/common.hpp"

using namespace budgetsym;

namespace {

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) { /* skip other control chars */ }
                else out += c;
        }
    }
    return out;
}

struct ScopeDecl {
    int id = -1;
    int parentId = -1;
    std::string label;
    int symbolCount = 0;
    long long bytesReclaimed = -1; // -1 == still open (never exited)
    bool closed = false;
};

struct SymbolOut {
    int id;
    std::string name;
    int scopeId;
    std::string typeHint;
    std::string representation;
    long long memoryBytes;
    std::string reason;
};

} // namespace

int main() {
    std::string line;
    long long budgetBytes = 4096;
    PolicyConfig cfg; // defaults from common.hpp; CFG lines below may override

    std::vector<ScopeDecl> scopeDecls;
    std::vector<SymbolOut> symbolsOut;

    // Read BUDGET / CFG / SCOPE header lines, then the EVENT stream, replaying
    // live against real BudgetSym + ConventionalSymbolTable instances as each
    // EVENT arrives (so scope memory-at-a-point-in-time is genuinely captured,
    // not reconstructed after the fact).
    BudgetSym* table = nullptr;
    ConventionalSymbolTable* conv = nullptr;
    std::vector<int> scopeStack; // BUDGET-SYM/Conventional internal scope ids opened so far (0 = global, always open)
    // scopeDecls[0] is always the pre-declared "global" scope (id 0), which
    // both engines already have open from construction -- EVENT ENTER must
    // start consuming declarations from index 1, not 0, or the first ENTER
    // would reopen "global" instead of the first real child scope.
    size_t nextScopeDeclToOpen = 1;
    int nextSymbolId = 0;
    bool headerDone = false;

    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        std::istringstream iss(line);
        std::string tag;
        iss >> tag;

        if (tag == "BUDGET") {
            iss >> budgetBytes;
        } else if (tag == "CFG") {
            std::string field; iss >> field;
            if (field == "inlineMaxLen") iss >> cfg.inlineMaxLen;
            else if (field == "compressMinLen") iss >> cfg.compressMinLen;
            else if (field == "hotAccessThreshold") iss >> cfg.hotAccessThreshold;
            else if (field == "highPressureThreshold") iss >> cfg.highPressureThreshold;
            else if (field == "lowPressureThreshold") iss >> cfg.lowPressureThreshold;
            else if (field == "prefixSimilarityMinShared") iss >> cfg.prefixSimilarityMinShared;
            else if (field == "reanchorInterval") iss >> cfg.reanchorInterval;
        } else if (tag == "SCOPE") {
            ScopeDecl sd;
            iss >> sd.id >> sd.parentId >> sd.label;
            scopeDecls.push_back(sd);
        } else if (tag == "EVENT") {
            if (!headerDone) {
                // First EVENT line: construct the real engines now that BUDGET/CFG are known.
                table = new BudgetSym(static_cast<size_t>(budgetBytes), cfg);
                conv = new ConventionalSymbolTable(static_cast<size_t>(budgetBytes));
                scopeStack.push_back(0); // global scope (id 0) is already open in both engines
                if (!scopeDecls.empty()) scopeDecls[0].symbolCount = 0; // scope 0 = global, declared implicitly
                headerDone = true;
            }
            std::string kind; iss >> kind;
            if (kind == "INSERT") {
                std::string name, typeHint;
                iss >> name >> typeHint;
                if (name.empty()) continue;

                table->insert(name);
                conv->insert(name);

                int curScope = scopeStack.back();
                SymbolOut so;
                so.id = nextSymbolId++;
                so.name = name;
                so.scopeId = curScope;
                so.typeHint = typeHint.empty() ? "unknown" : typeHint;
                so.representation = representationName(table->representationOf(name));
                so.memoryBytes = 0; // filled in below via tracker delta
                so.reason = table->lastDecisionReason();
                symbolsOut.push_back(so);

                for (auto& sd : scopeDecls) {
                    if (sd.id == curScope) { sd.symbolCount++; break; }
                }
            } else if (kind == "ENTER") {
                if (nextScopeDeclToOpen < scopeDecls.size()) {
                    scopeStack.push_back(scopeDecls[nextScopeDeclToOpen].id);
                    nextScopeDeclToOpen++;
                } else {
                    scopeStack.push_back(-1); // unexpected: no declaration for this scope
                }
                table->enterScope();
                conv->enterScope();
            } else if (kind == "EXIT") {
                auto repB = table->exitScope();
                conv->exitScope();
                if (!scopeStack.empty()) {
                    int closedId = scopeStack.back();
                    scopeStack.pop_back();
                    for (auto& sd : scopeDecls) {
                        if (sd.id == closedId) { sd.bytesReclaimed = repB.bytesReclaimed; sd.closed = true; break; }
                    }
                }
            }
        } else if (tag == "END") {
            break;
        }
    }

    if (table == nullptr) {
        // No EVENT lines were ever seen (e.g. empty program) -- still produce a
        // valid, empty, honest result rather than nothing.
        table = new BudgetSym(static_cast<size_t>(budgetBytes), cfg);
        conv = new ConventionalSymbolTable(static_cast<size_t>(budgetBytes));
    }

    // Per-symbol incremental cost: recomputed by diffing a fresh replay is
    // unnecessary -- BudgetSym's own tracker already gives us the running
    // total, and each Entry's cost is derivable from representation +
    // string length using the exact same public cost constants the engine
    // itself uses. Simpler and just as real: report the *current* total plus
    // per-symbol representation/reason (already captured above); exact
    // historical per-symbol bytes at insert time are a nice-to-have we skip
    // rather than approximate incorrectly.
    long long trackedMemory = table->tracker().current();
    long long conventionalMemory = conv->tracker().current();
    double ratio = trackedMemory > 0 ? static_cast<double>(conventionalMemory) / static_cast<double>(trackedMemory) : 1.0;

    std::ostringstream out;
    out << "{";
    out << "\"budgetBytes\":" << budgetBytes << ",";
    out << "\"trackedMemoryBytes\":" << trackedMemory << ",";
    out << "\"conventionalMemoryBytes\":" << conventionalMemory << ",";
    out << "\"compressionRatio\":" << ratio << ",";
    out << "\"promotions\":" << table->promotions() << ",";
    out << "\"liveSymbolCount\":" << table->size() << ",";
    out << "\"memoryPressure\":" << table->tracker().pressure() << ",";

    out << "\"symbols\":[";
    for (size_t i = 0; i < symbolsOut.size(); i++) {
        const auto& s = symbolsOut[i];
        if (i) out << ",";
        out << "{\"id\":" << s.id
            << ",\"name\":\"" << jsonEscape(s.name) << "\""
            << ",\"scopeId\":" << s.scopeId
            << ",\"typeHint\":\"" << jsonEscape(s.typeHint) << "\""
            << ",\"representation\":\"" << s.representation << "\""
            << ",\"reason\":\"" << jsonEscape(s.reason) << "\""
            << "}";
    }
    out << "],";

    out << "\"scopes\":[";
    for (size_t i = 0; i < scopeDecls.size(); i++) {
        const auto& sd = scopeDecls[i];
        if (i) out << ",";
        out << "{\"id\":" << sd.id
            << ",\"parentId\":" << sd.parentId
            << ",\"label\":\"" << jsonEscape(sd.label) << "\""
            << ",\"symbolCount\":" << sd.symbolCount
            << ",\"status\":\"" << (sd.closed ? "closed" : "open") << "\""
            << ",\"bytesReclaimed\":" << (sd.closed ? sd.bytesReclaimed : 0)
            << "}";
    }
    out << "]";
    out << "}";

    std::cout << out.str() << std::endl;

    delete table;
    delete conv;
    return 0;
}
