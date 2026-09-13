#pragma once
// Swappable hash-function backends for BudgetSym's lookup index.
//
// BudgetSym cannot key its index by the identifier string itself (see
// docs/architecture.md, "Why the lookup index cannot be keyed by the
// identifier string itself") -- it hashes to a 64-bit key and reconstructs
// candidates to verify equality. The hash function used for that first step
// is one axis of "how fast/well-distributed is the lookup index", independent
// of the hash-then-reconstruct cost itself (which the LRU cache in
// include/lru_cache.hpp targets instead -- see docs/caching.md for why these
// are two separate levers, not the same fix twice).
//
// Every hash here returns a 64-bit value so all of them are drop-in
// replacements for fnv1a() as BudgetSymT's HashFn template parameter.
#include <cstdint>
#include <cstring>
#include <string>

namespace budgetsym {

// ---- FNV-1a 64-bit (the original, already in common.hpp) ------------------
// Kept here too (identical algorithm) so every hash backend lives in one
// place with a uniform `struct { static uint64_t hash(const std::string&); }`
// shape that BudgetSymT can be templated on.
struct FnvHash {
    static const char* name() { return "FNV-1a"; }
    static uint64_t hash(const std::string& s) {
        uint64_t h = 1469598103934665603ULL;
        for (unsigned char c : s) {
            h ^= c;
            h *= 1099511628211ULL;
        }
        return h;
    }
};

// ---- MurmurHash3 (x86_32 finalizer, run twice with different seeds and -----
// packed into 64 bits) -------------------------------------------------------
// This is NOT the canonical MurmurHash3_x64_128 algorithm -- implementing the
// real 128-bit x64 variant is a larger undertaking than this project's
// symbol-table lookup path warrants, and claiming it without implementing it
// exactly would misrepresent what's actually running. What's here is the
// well-known public-domain 32-bit finalizer (Austin Appleby, MurmurHash3),
// applied twice with two different seeds and concatenated into a uint64_t --
// a standard, honestly-labeled way to widen a 32-bit hash for use as a 64-bit
// index key. Good avalanche behavior (small input changes flip roughly half
// the output bits), which is the actual property that matters for bucket
// distribution here.
struct Murmur3Hash {
    static const char* name() { return "MurmurHash3 (32-bit x2, widened to 64-bit)"; }

    static uint32_t murmur3_32(const std::string& s, uint32_t seed) {
        const uint8_t* key = reinterpret_cast<const uint8_t*>(s.data());
        size_t len = s.size();
        uint32_t h = seed;
        const uint32_t c1 = 0xcc9e2d51;
        const uint32_t c2 = 0x1b873593;

        size_t nblocks = len / 4;
        for (size_t i = 0; i < nblocks; i++) {
            uint32_t k;
            std::memcpy(&k, key + i * 4, sizeof(uint32_t));
            k *= c1;
            k = (k << 15) | (k >> 17);
            k *= c2;
            h ^= k;
            h = (h << 13) | (h >> 19);
            h = h * 5 + 0xe6546b64;
        }

        const uint8_t* tail = key + nblocks * 4;
        uint32_t k1 = 0;
        size_t tailLen = len & 3;
        if (tailLen == 3) k1 ^= static_cast<uint32_t>(tail[2]) << 16;
        if (tailLen >= 2) k1 ^= static_cast<uint32_t>(tail[1]) << 8;
        if (tailLen >= 1) {
            k1 ^= static_cast<uint32_t>(tail[0]);
            k1 *= c1;
            k1 = (k1 << 15) | (k1 >> 17);
            k1 *= c2;
            h ^= k1;
        }

        h ^= static_cast<uint32_t>(len);
        h ^= h >> 16;
        h *= 0x85ebca6b;
        h ^= h >> 13;
        h *= 0xc2b2ae35;
        h ^= h >> 16;
        return h;
    }

    static uint64_t hash(const std::string& s) {
        uint32_t lo = murmur3_32(s, 0x9747b28cU);
        uint32_t hi = murmur3_32(s, 0x1b873593U);
        return (static_cast<uint64_t>(hi) << 32) | static_cast<uint64_t>(lo);
    }
};

// ---- DJB2 (Bernstein hash), widened to 64-bit ------------------------------
// The simplest of the three: a single multiply-and-add per byte, no mixing
// step at all. Included as the "cheap end" comparison point -- if it turns
// out to perform close to FNV-1a/Murmur3 on these datasets, that is itself a
// useful, honestly-reported finding (identifier strings are short and mostly
// alphabetic, which is a much easier case than adversarial input).
struct Djb2Hash {
    static const char* name() { return "DJB2"; }
    static uint64_t hash(const std::string& s) {
        uint64_t h = 5381ULL;
        for (unsigned char c : s) {
            h = ((h << 5) + h) + c; // h * 33 + c
        }
        return h;
    }
};

} // namespace budgetsym
