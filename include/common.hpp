#pragma once
// BUDGET-SYM: shared types used by all three symbol-table implementations.
#include <cstdint>
#include <string>
#include <cstddef>

namespace budgetsym {

enum class Representation : uint8_t { INLINE_REP = 0, INTERNED_REP = 1, COMPRESSED_REP = 2 };

inline const char* representationName(Representation r) {
    switch (r) {
        case Representation::INLINE_REP:     return "INLINE";
        case Representation::INTERNED_REP:   return "INTERNED";
        case Representation::COMPRESSED_REP: return "COMPRESSED";
    }
    return "UNKNOWN";
}

// FNV-1a 64-bit. Used only as a fast, deterministic index key for BUDGET-SYM's
// lookup structure -- not a claim of cryptographic strength.
inline uint64_t fnv1a(const std::string& s) {
    uint64_t h = 1469598103934665603ULL;
    for (unsigned char c : s) {
        h ^= c;
        h *= 1099511628211ULL;
    }
    return h;
}

inline size_t commonPrefixLen(const std::string& a, const std::string& b) {
    size_t n = a.size() < b.size() ? a.size() : b.size();
    size_t i = 0;
    while (i < n && a[i] == b[i]) ++i;
    return i;
}

// All thresholds the adaptive policy uses. Deliberately made data, not magic
// numbers baked into decide() -- see docs/methodology.md for how these were
// chosen (empirically reasonable starting points, not tuned/optimal values).
struct PolicyConfig {
    size_t inlineMaxLen = 12;                 // identifiers shorter than this are INLINE candidates
    size_t compressMinLen = 10;               // identifiers this long (or longer) are COMPRESSED candidates
    double lowPressureThreshold = 0.50;       // memory/budget below this counts as "low pressure"
    double highPressureThreshold = 0.85;      // memory/budget at/above this counts as "high pressure"
    size_t hotAccessThreshold = 3;            // accesses at/above this count as "hot" -> favor fast repr
    size_t reanchorInterval = 8;              // COMPRESSED chain re-anchors every N inserts (bounds decode depth)
    size_t prefixSimilarityMinShared = 4;     // min shared prefix chars with the last COMPRESSED identifier

    // Ablation switch: when set, decide() skips all heuristics below and always
    // returns fixedRepresentation. Used by ablation.cpp to build the
    // "BudgetSym-NoAdaptiveSelection" variant without duplicating the class.
    bool disableAdaptiveSelection = false;
    Representation fixedRepresentation = Representation::INTERNED_REP;
};

struct SymbolMeta {
    int id = -1;
    int scopeId = -1;
    int typeId = 0;
    size_t accessCount = 0;
    Representation representation = Representation::INLINE_REP;
};

} // namespace budgetsym
