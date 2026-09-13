# Lookup Caching: a Real Bug Found During Review, and the Cache's Measured Effect

## A real correctness bug found while reviewing/extending the Review-2 cache

`include/lookup_cache.hpp`'s `LRULookupCache` (wired into `BudgetSym::lookup()`
in `budget_sym.hpp`) is keyed by `(hash, name)` with **no scope awareness**.
Reviewing it while adding `include/hash_functions.hpp`'s hash-function
templating surfaced a real correctness bug: a nested-scope declaration that
**shadows** an outer declaration of the same name was not invalidating the
outer declaration's cache entry, so `lookup()`'s cache fast path could
resolve a shadowed name to the wrong, stale, outer-scope entry.

**Confirmed empirically**, not just reasoned about, with a targeted
reproduction (`tests/smoke_test.cpp`'s `test_lookup_cache_respects_scope_shadowing`,
now a permanent regression test):

```cpp
PolicyConfig cfg;
cfg.compressMinLen = 1; cfg.highPressureThreshold = 0.0; cfg.hotAccessThreshold = 2;
BudgetSym t(1 << 20, cfg);
t.insert("x");              // outer x -> COMPRESSED_REP (isRepeat=false, forced high pressure)
t.lookup("x");               // populates the cache for hash("x") -> outer id
t.enterScope();
t.insert("x");                // inner x -> INTERNED_REP (isRepeat=true; shadows outer)
t.lookup("x"); t.lookup("x"); t.lookup("x");
// promotions() came back 1 before the fix: the 3 lookups incremented the
// OUTER (COMPRESSED) entry's accessCount via a stale cache hit and promoted
// it, even though the inner "x" is the only symbol that should be visible.
// After the fix: promotions() == 0, confirming lookup() resolved correctly.
```

Root cause: `exitScope()` already calls `lookupCache_.invalidate(hash)` for
every symbol in a closing scope, but nothing invalidated the cache when a
**new** declaration opens under an already-cached hash -- which is exactly
what a shadowing redeclaration does. `insert()` never touched the cache at
all before this fix.

**Fix** (`include/budget_sym.hpp`'s `insert()`): call
`lookupCache_.invalidate(h)` for the new entry's hash immediately after
computing it, before inserting into `hashIndex`. Any prior cache entry for
that hash -- correct or not -- is dropped, so the next lookup for that name
does a real scope-stack scan and re-populates the cache with the correct,
innermost-visible entry. Verified this doesn't regress the cache's own
tests (`test_budgetsym_lookup_cache_hit_rate`,
`test_budgetsym_lookup_cache_invalidation_on_scope_exit` both still pass)
and doesn't change any memory/compression numbers (the fix only touches
cache bookkeeping, never `MemoryTracker`).

Why the existing test suite didn't catch this: `test_budgetsym_lookup_cache_invalidation_on_scope_exit`
tests a name (`"scopedTemp"`) that exists *only* in the inner scope -- it
never exercises the shadowing case (same name declared in two enclosing
scopes). Noted here explicitly because it's the kind of gap that's easy to
miss even with real, passing tests: "the cache is tested" and "the cache is
tested for every case that matters" are different claims.

## What the cache is actually for, and what it costs

`lookup()`'s hash-then-reconstruct path (`docs/faculty_questions.md`,
"Does compression hurt lookup?") is the direct cost this cache targets: a
cache hit skips the bucket walk and the reconstruct-and-compare step
entirely for a name looked up recently. `setLookupCacheEnabled(bool)`
toggles it on the same `BudgetSym` class, which is how
`src/cache_benchmark_main.cpp` produces a clean on/off comparison.

Two phases per dataset, deliberately different (full methodology and why
in the file's header comment): **cold** (every lookup a first-time query --
the cache cannot help, this phase shows its bookkeeping overhead) and
**repeated** (a 32-identifier hot subset, sized to fit comfortably inside
the cache's fixed 64-entry capacity, looked up 10x over).

| Dataset | Cold: off -> on | Repeated: off -> on | Speedup (repeated) | Hit rate (on) |
|---|---|---|---|---|
| small | 0.132 -> 0.382us | 0.047 -> 0.077us | 0.61x (regression) | 90% |
| medium | 0.155 -> 0.338us | 0.077 -> 0.102us | 0.75x (regression) | 90% |
| large | 1.619 -> 0.360us | 0.058 -> 0.093us | 0.63x (regression) | 90% |
| high-prefix-similarity | 0.194 -> 0.422us | 0.220 -> 0.188us | 1.17x | 90% |
| random-identifiers | 0.104 -> 0.359us | 0.085 -> 0.083us | ~flat (1.03x) | 90% |
| nested-scopes | 0.139 -> 0.373us | 0.118 -> 0.132us | 0.89x (regression) | 90% |
| hot-cold-access | 0.143 -> 0.330us | 0.458 -> 0.149us | **3.08x** | 90% |
| memory-stress | 0.191 -> 1.074us | 0.167 -> 0.110us | 1.52x | 90% |

Single-run numbers on a shared, non-isolated machine -- exact multipliers
shift between runs (observed directly while building this: re-running
produced different numbers every time, sometimes flipping which side of
1.0x a borderline dataset landed on). Do not read the exact figures above
as reproducible constants; read the pattern: cold lookups are always
slower with caching on (bookkeeping paid on every guaranteed miss), and
the repeated-lookup win is real and large specifically where the entries
being re-looked-up are expensive to reconstruct (`hot-cold-access` and
`memory-stress`, both COMPRESSED-heavy under the default policy) and
absent or a net loss where they aren't. This is the same conditional,
not-universal finding this project already reports honestly for BudgetSym
vs. its baselines -- the cache is a further memory-for-latency-style trade
within BudgetSym itself, not a strict win.

See also `docs/algorithm_comparison.md` for a structurally different answer
to the same lookup-cost question: RobinHood's open addressing avoids
needing reconstruction at all, for every lookup, at the cost of the
compression this cache's underlying data structure exists to provide.
