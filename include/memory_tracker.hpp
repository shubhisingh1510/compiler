#pragma once
// MemoryTracker accounts for *modeled* costs of the bytes each symbol-table
// implementation actually allocates for identifier storage + per-symbol metadata
// (see docs/methodology.md for the exact cost model of every representation).
//
// IMPORTANT: this is NOT a measurement of OS-level process RSS or malloc arena
// usage. It is a deterministic sum of documented, reproducible per-entry byte
// costs computed from data the program actually stores. Every number derived
// from it is reported as "Tracked Memory" for that reason -- never as "actual
// physical memory used".
#include <cstddef>
#include <algorithm>

namespace budgetsym {

class MemoryTracker {
public:
    explicit MemoryTracker(size_t budgetBytes = 0) : budget_(budgetBytes) {}

    void setBudget(size_t b) { budget_ = b; }
    size_t budget() const { return budget_; }

    void add(long long bytes) {
        current_ += bytes;
        if (current_ > peak_) peak_ = current_;
    }
    void reclaim(long long bytes) {
        current_ -= bytes;
        if (current_ < 0) current_ = 0;
    }

    long long current() const { return current_; }
    long long peak() const { return peak_; }

    double pressure() const {
        if (budget_ == 0) return 0.0;
        double p = static_cast<double>(current_) / static_cast<double>(budget_);
        return p < 0.0 ? 0.0 : (p > 1.0 ? 1.0 : p);
    }

    long long remaining() const { return static_cast<long long>(budget_) - current_; }

private:
    size_t budget_;
    long long current_ = 0;
    long long peak_ = 0;
};

} // namespace budgetsym
