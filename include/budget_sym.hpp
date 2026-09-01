#pragma once
// BUDGET-SYM -- the proposed adaptive scope-aware symbol table.
//
// Unlike the two baselines, BUDGET-SYM cannot key its lookup structure by the
// identifier string itself (that would force every symbol to pay for a full
// string copy regardless of representation, defeating the entire point). So
// each scope instead maps a fast 64-bit hash of the name to candidate entry
// ids; on lookup, each candidate's identifier is reconstructed from whatever
// representation it actually uses and compared to the query string. This is
// the direct cause of COMPRESSED's slower lookup relative to INLINE/INTERNED
// (see docs/faculty_questions.md, "Does compression hurt lookup?").
//
// Three representations, chosen per-symbol by decide():
//   INLINE     -- short string stored directly on the entry (cheapest lookup, no sharing)
//   INTERNED   -- index into a shared, refcounted string pool (used for exact repeats)
//   COMPRESSED -- front-coded (prefix-shared) against the previous COMPRESSED
//                 identifier in insertion order, re-anchored every
//                 cfg.reanchorInterval inserts to bound decode chain depth
//
// The policy also *adapts after insertion*: recordAccess()/lookup() promote a
// COMPRESSED entry to INTERNED once its access count crosses hotAccessThreshold,
// trading its memory saving for O(1)-ish lookup. This is the part of the
// mechanism that is genuinely adaptive over time, not just a one-shot decision
// made with only insert-time information.
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <cstdint>
#include "common.hpp"
#include "memory_tracker.hpp"

namespace budgetsym {

class BudgetSym {
public:
    explicit BudgetSym(size_t budgetBytes, PolicyConfig cfg = PolicyConfig())
        : tracker_(budgetBytes), cfg_(cfg) {
        scopes_.emplace_back();
    }

    int enterScope() {
        scopes_.emplace_back();
        return static_cast<int>(scopes_.size()) - 1;
    }

    struct ScopeExitReport { size_t symbolsReleased = 0; long long bytesReclaimed = 0; };

    ScopeExitReport exitScope() {
        ScopeExitReport rep;
        if (scopes_.size() <= 1) return rep;
        for (auto& kv : scopes_.back().hashIndex) {
            int id = kv.second;
            Entry& e = entries_[id];
            if (e.tombstoned) continue;
            long long freed = releaseEntry(e);
            e.tombstoned = true;
            rep.bytesReclaimed += freed;
            rep.symbolsReleased++;
        }
        scopes_.pop_back();
        return rep;
    }

    // accessFreqHint: an optional caller-supplied hint (e.g. "this identifier
    // is a loop counter, expect heavy reuse") used only at decision time.
    // Real compilers rarely know true future access counts at declaration
    // time either -- this mirrors that constraint. Actual runtime access
    // (via lookup()/recordAccess()) is what drives the promotion adaptivity.
    int insert(const std::string& name, int typeId = 0, size_t accessFreqHint = 0) {
        int id = static_cast<int>(entries_.size());
        bool isRepeat = seen_.find(name) != seen_.end();
        seen_.insert(name);

        // Similarity signal for the *policy decision* is "does this identifier
        // share a long prefix with whatever was inserted immediately before
        // it" (e.g. a run of temperatureSensorX/Y/Z declarations) -- deliberately
        // independent of the *physical* front-coding chain (insertCompressed()
        // below always front-codes against the true previous COMPRESSED entry,
        // whatever that was). Comparing only against the last COMPRESSED entry
        // here would mean nothing could ever become the chain's first entry.
        size_t prefixShared = lastInsertedFull_.empty() ? 0 : commonPrefixLen(lastInsertedFull_, name);
        Representation rep = decide(name, isRepeat, tracker_.pressure(), accessFreqHint, prefixShared);
        lastInsertedFull_ = name;

        Entry e;
        e.meta.id = id;
        e.meta.scopeId = static_cast<int>(scopes_.size()) - 1;
        e.meta.typeId = typeId;
        e.meta.representation = rep;
        e.meta.accessCount = accessFreqHint;

        long long cost = materialize(e, name, rep);
        tracker_.add(cost);

        entries_.push_back(e);
        uint64_t h = fnv1a(name);
        scopes_.back().hashIndex.insert(std::make_pair(h, id));
        return id;
    }

    bool lookup(const std::string& name) {
        uint64_t h = fnv1a(name);
        for (auto sIt = scopes_.rbegin(); sIt != scopes_.rend(); ++sIt) {
            auto range = sIt->hashIndex.equal_range(h);
            for (auto it = range.first; it != range.second; ++it) {
                Entry& e = entries_[it->second];
                if (e.tombstoned) continue;
                if (reconstructName(e) == name) {
                    e.meta.accessCount++;
                    maybePromote(e, name);
                    return true;
                }
            }
        }
        return false;
    }

    void recordAccess(const std::string& name) { lookup(name); } // lookup already counts + promotes

    Representation representationOf(const std::string& name) {
        uint64_t h = fnv1a(name);
        for (auto sIt = scopes_.rbegin(); sIt != scopes_.rend(); ++sIt) {
            auto range = sIt->hashIndex.equal_range(h);
            for (auto it = range.first; it != range.second; ++it) {
                Entry& e = entries_[it->second];
                if (!e.tombstoned && reconstructName(e) == name) return e.meta.representation;
            }
        }
        return Representation::INLINE_REP;
    }

    size_t size() const {
        size_t n = 0;
        for (auto& e : entries_) if (!e.tombstoned) n++;
        return n;
    }

    const MemoryTracker& tracker() const { return tracker_; }
    const PolicyConfig& config() const { return cfg_; }
    size_t promotions() const { return promotions_; }

private:
    struct Entry {
        SymbolMeta meta;
        std::string inlineStr;   // valid when representation == INLINE_REP
        int poolIndex = -1;      // valid when representation == INTERNED_REP
        int compIndex = -1;      // valid when representation == COMPRESSED_REP
        bool tombstoned = false;
    };

    struct CompEntry {
        uint8_t sharedPrefixLen = 0;
        std::string suffix;
        int prevIndex = -1;
    };

    struct Scope {
        std::unordered_multimap<uint64_t, int> hashIndex;
    };

    // ---- policy ----------------------------------------------------------
    Representation decide(const std::string& name, bool isRepeat, double pressure,
                           size_t accessFreqHint, size_t prefixShared) const {
        if (cfg_.disableAdaptiveSelection) return cfg_.fixedRepresentation;

        bool hot = accessFreqHint >= cfg_.hotAccessThreshold;
        bool longId = name.size() >= cfg_.compressMinLen;
        bool prefixSimilar = prefixShared >= cfg_.prefixSimilarityMinShared;
        bool highPressure = pressure >= cfg_.highPressureThreshold;
        bool lowPressure = pressure < cfg_.lowPressureThreshold;

        // Exact repeats: interning is essentially free memory-wise (shared,
        // refcounted) and keeps O(1)-ish lookup, so it always wins over
        // paying for a second full or compressed copy of the same string.
        if (isRepeat) return Representation::INTERNED_REP;

        // Under real memory pressure, prefer the compact representation for
        // anything long enough to be worth compressing -- unless it's hot,
        // in which case lookup speed matters more than the bytes saved.
        if (highPressure && longId && !hot) return Representation::COMPRESSED_REP;

        // Not under pressure, but this identifier front-codes well against
        // its predecessor and isn't hot: still worth compressing opportunistically.
        if (longId && prefixSimilar && !hot) return Representation::COMPRESSED_REP;

        // Short identifier, plenty of budget left: cheapest possible path,
        // no pool indirection needed.
        if (name.size() < cfg_.inlineMaxLen && lowPressure) return Representation::INLINE_REP;

        // Default / fallback: balanced cost and lookup speed.
        return Representation::INTERNED_REP;
    }

    // Promote a COMPRESSED entry to INTERNED once it's been accessed enough
    // to count as "hot" -- trading its memory saving for faster lookup.
    // Caveat (documented, not hidden): if this entry's compPool_ slot is a
    // chain interior node with descendants, that slot's bytes cannot be
    // physically freed without breaking the decode chain for those
    // descendants, so the byte credit here only reflects the entry's own
    // logical accounting -- same fragmentation trade-off as scope-exit
    // tombstoning. See docs/future_work.md.
    void maybePromote(Entry& e, const std::string& name) {
        if (e.meta.representation != Representation::COMPRESSED_REP) return;
        if (e.meta.accessCount < cfg_.hotAccessThreshold) return;
        long long oldCost = costOf(e);
        int idx = internName(name);
        tracker_.reclaim(oldCost);
        e.poolIndex = idx;
        e.compIndex = -1;
        e.meta.representation = Representation::INTERNED_REP;
        long long newCost = costOf(e);
        tracker_.add(newCost);
        promotions_++;
    }

    long long materialize(Entry& e, const std::string& name, Representation rep) {
        switch (rep) {
            case Representation::INLINE_REP:
                e.inlineStr = name;
                return static_cast<long long>(name.size() + 1 + kInlineOverhead);
            case Representation::INTERNED_REP: {
                e.poolIndex = internName(name);
                return kInternedOverhead;
            }
            case Representation::COMPRESSED_REP: {
                e.compIndex = insertCompressed(name);
                const CompEntry& ce = compPool_[e.compIndex];
                return static_cast<long long>(1 + ce.suffix.size() + 1 + kCompressedLinkOverhead);
            }
        }
        return 0;
    }

    long long costOf(const Entry& e) const {
        switch (e.meta.representation) {
            case Representation::INLINE_REP:
                return static_cast<long long>(e.inlineStr.size() + 1 + kInlineOverhead);
            case Representation::INTERNED_REP:
                return kInternedOverhead;
            case Representation::COMPRESSED_REP: {
                const CompEntry& ce = compPool_[e.compIndex];
                return static_cast<long long>(1 + ce.suffix.size() + 1 + kCompressedLinkOverhead);
            }
        }
        return 0;
    }

    long long releaseEntry(Entry& e) {
        switch (e.meta.representation) {
            case Representation::INLINE_REP: {
                long long freed = static_cast<long long>(e.inlineStr.size() + 1 + kInlineOverhead);
                tracker_.reclaim(freed);
                return freed;
            }
            case Representation::INTERNED_REP: {
                long long freed = releasePoolRef(e.poolIndex) + kInternedOverhead;
                tracker_.reclaim(freed);
                return freed;
            }
            case Representation::COMPRESSED_REP: {
                // Only the chain *tail* (no descendants yet) can be physically
                // reclaimed; interior nodes are logically dropped (excluded
                // from lookup via tombstoned=true) but keep their bytes
                // allocated until the next re-anchor walks past them. This is
                // an explicit, documented limitation -- see docs/future_work.md.
                long long own = costOf(e);
                if (chainTail_ == e.compIndex) {
                    tracker_.reclaim(own);
                    chainTail_ = compPool_[e.compIndex].prevIndex;
                    return own;
                }
                return 0;
            }
        }
        return 0;
    }

    // Charges the tracker for the pool string's bytes exactly once, at the
    // moment a name is first interned (mirrors InternedSymbolTable's own
    // accounting) -- every subsequent internName() call for the same name
    // only bumps the refcount and costs nothing extra. Bug this fixes: an
    // earlier version left this uncharged entirely, silently making every
    // INTERNED_REP entry look cheaper than it actually is.
    int internName(const std::string& name) {
        auto it = poolLookup_.find(name);
        if (it != poolLookup_.end()) { poolRefCount_[it->second]++; return it->second; }
        int idx = static_cast<int>(pool_.size());
        pool_.push_back(name);
        poolRefCount_.push_back(1);
        poolLookup_[name] = idx;
        tracker_.add(static_cast<long long>(sizeof(std::string) + name.size() + 1));
        return idx;
    }

    long long releasePoolRef(int idx) {
        poolRefCount_[idx]--;
        if (poolRefCount_[idx] == 0) {
            return static_cast<long long>(sizeof(std::string) + pool_[idx].size() + 1);
        }
        return 0;
    }

    std::string reconstructFull(int idx) const {
        const CompEntry& ce = compPool_[idx];
        if (ce.prevIndex == -1) return ce.suffix;
        std::string prev = reconstructFull(ce.prevIndex);
        return prev.substr(0, ce.sharedPrefixLen) + ce.suffix;
    }

    std::string reconstructName(const Entry& e) const {
        switch (e.meta.representation) {
            case Representation::INLINE_REP:   return e.inlineStr;
            case Representation::INTERNED_REP: return pool_[e.poolIndex];
            case Representation::COMPRESSED_REP: return reconstructFull(e.compIndex);
        }
        return "";
    }

    int insertCompressed(const std::string& name) {
        bool reanchor = compPool_.empty() || (compressedInsertCount_ % cfg_.reanchorInterval == 0);
        compressedInsertCount_++;
        CompEntry ce;
        if (reanchor || chainTail_ == -1) {
            ce.sharedPrefixLen = 0;
            ce.suffix = name;
            ce.prevIndex = -1;
        } else {
            std::string prevFull = reconstructFull(chainTail_);
            size_t shared = commonPrefixLen(prevFull, name);
            if (shared > 255) shared = 255;
            ce.sharedPrefixLen = static_cast<uint8_t>(shared);
            ce.suffix = name.substr(shared);
            ce.prevIndex = chainTail_;
        }
        compPool_.push_back(ce);
        int idx = static_cast<int>(compPool_.size()) - 1;
        chainTail_ = idx;
        return idx;
    }

    static const long long kInlineOverhead = 28;          // SymbolMeta + std::string control block
    static const long long kInternedOverhead = 28;         // SymbolMeta + 4-byte pool index
    static const long long kCompressedLinkOverhead = 29;   // SymbolMeta + prevIndex(4) + misc chain bookkeeping

    std::vector<Entry> entries_;
    std::vector<Scope> scopes_;
    std::unordered_set<std::string> seen_;

    std::vector<std::string> pool_;
    std::vector<int> poolRefCount_;
    std::unordered_map<std::string, int> poolLookup_;

    std::vector<CompEntry> compPool_;
    int chainTail_ = -1;
    size_t compressedInsertCount_ = 0;
    std::string lastInsertedFull_; // most recent insert()'d name, any representation

    size_t promotions_ = 0;
    MemoryTracker tracker_;
    PolicyConfig cfg_;
};

} // namespace budgetsym
