# Algorithm Comparison (Task 2: Hashing + Compression/Storage)

Five algorithms compared on the same 8 datasets, same seeds, same
tracked-memory cost-accounting style as `results/benchmark_results.csv`
(`results/algorithm_comparison.csv`, `figures/algorithm_compression_ratio.png`,
`figures/algorithm_lookup_latency.png`):

- **BudgetSym-FNV1a** -- today's default (the existing `BudgetSym` alias),
  reference point.
- **BudgetSym-Murmur3** / **BudgetSym-DJB2** -- the identical adaptive
  policy (`decide()` untouched, `PolicyConfig` untouched), only the index's
  hash function swapped (`include/hash_functions.hpp`; see
  `include/budget_sym.hpp`'s `BudgetSymT<HashFn>` template).
- **RobinHood** -- direct string-keyed open addressing, no adaptive
  representation selection at all (`include/robinhood_symbol_table.hpp`,
  `docs/robinhood.md`).
- **Trie** -- shared prefix tree, no adaptive selection either
  (`include/trie_symbol_table.hpp`, `docs/trie.md`).

## Which hash function wins? None of them, meaningfully.

Memory is bit-for-bit identical across all three BudgetSym variants on every
dataset, every run (expected and exactly reproducible: the hash function
affects only which bucket an entry lands in, never what gets stored).
Lookup latency differs between the three hash functions, but which one comes
out ahead on a given dataset **changes from run to run** on this shared,
non-isolated machine -- re-running `algorithm_benchmark.exe` a handful of
times during this work never produced the same ranking twice, and the
spread between the fastest and slowest hash on any dataset stays within
roughly the same noise band the timings themselves carry. That instability
is itself the finding, not a gap in the measurement: it means the
differences are too small to rank reliably, which is a different and more
defensible claim than picking one run's ranking and presenting it as *the*
result. **Honest conclusion**: hash function choice barely matters for this
workload. Identifier strings are short (single digits to a few dozen
characters) and the dominant lookup cost is reconstruction
(`docs/faculty_questions.md`), not hash computation -- a faster or
better-distributed hash cannot address a cost that happens after the hash
is already computed. `tests/smoke_test.cpp`'s
`test_murmur3_deterministic_and_differs_from_fnv` confirms the two
algorithms are genuinely different functions (not an accidental
delegation), so this is a real empirical finding, not a testing artifact.

## Best per dataset, by metric

| Dataset | Best compression | Best lookup (hit) |
|---|---|---|
| small | BudgetSym (any hash), 1.65x | RobinHood, 0.052us |
| medium | BudgetSym (any hash), 1.63x | RobinHood, 0.055us |
| large | BudgetSym (any hash), 1.64x | RobinHood, 0.054us |
| high-prefix-similarity | BudgetSym (any hash), 2.37x | RobinHood, 0.082us |
| random-identifiers | BudgetSym (any hash), 1.34x | RobinHood, 0.061us |
| nested-scopes | BudgetSym (any hash), 1.84x | RobinHood, 0.054us |
| hot-cold-access | BudgetSym (any hash), 1.57x | RobinHood, 0.046us |
| memory-stress | BudgetSym (any hash), 1.38x | RobinHood, 0.105us |

(Compression ratios reproduce exactly across runs given the same seed --
including on `medium`/`large`/`random-identifiers`/`hot-cold-access`, where
these numbers are noticeably higher than an earlier pre-merge measurement
of BudgetSym alone. That shift is real and expected, not noise: it's the
Review-2 ML threshold predictor (`include/predicted_thresholds.hpp`)
silently replacing the default `PolicyConfig` after the first 100 inserts
based on each dataset's observed features -- a deterministic function of
the (seeded) input, so still exactly reproducible, just no longer equal to
the fixed-threshold numbers from before that feature existed. Lookup-latency
values carry the usual single-run, shared-machine caveat -- the *ranking*,
RobinHood fastest and BudgetSym most memory-efficient on every dataset with
no overlap, reproduced across every rerun performed while building this,
even where the exact microsecond figures shifted.)

**RobinHood wins lookup latency on every single dataset**, typically by
roughly an order of magnitude or more over any BudgetSym variant (the exact
multiplier swings widely between runs -- anywhere from ~7x to 50x+ observed
-- but the ranking itself never changed across any rerun), and **BudgetSym
wins compression on every single dataset** (deterministic, reproduces
exactly; Trie never wins either metric outright -- see below). This
is not a coincidence, it is the direct, structural consequence of what each
design optimizes for:

- BudgetSym pays a reconstruction cost specifically *because* it stores
  compressed/shared representations that a direct string key can't.
- RobinHood pays no reconstruction cost specifically *because* it stores
  full, uncompressed strings with no sharing -- and, per `docs/robinhood.md`,
  pays real "slack" memory overhead for that (empty preallocated slots) on
  top of storing full strings, a cost `slackBytes()` reports separately so it
  doesn't silently disappear from the comparison.

There is no dataset in this benchmark where one algorithm wins both memory
and lookup speed. **"Best overall" depends entirely on which resource is
scarcer in the target deployment** -- exactly the memory-vs-latency framing
`README.md` already uses for BudgetSym vs. the two original baselines,
extended here to a wider set of concrete structural choices.

## Where Trie fits: never best, but not without a role

Trie's compression ratio is *worse than the Conventional baseline* on 7 of 8
datasets (as low as 0.15x on `memory-stress`) -- see `docs/trie.md` for why
(per-character node overhead exceeds front-coding's raw suffix bytes when
there's little global prefix sharing to exploit). Its lookup latency sits
between BudgetSym and RobinHood on most datasets, but loses to *all three*
BudgetSym variants on `random-identifiers`, where BudgetSym's adaptive
policy can fall back to a cheap representation and a trie cannot. Trie's one
clear structural win: rejecting an absent identifier is very fast (often the
fastest of all five, `docs/trie.md`'s table), because a missing character
early in the walk ends the search immediately, no hashing or reconstruction
involved.

## Reading this alongside the caching work (Task 1)

`docs/caching.md` makes BudgetSym's lookup cost for *repeated* accesses to
compressed entries competitive again (1.3x-2.3x faster with caching on, on
the datasets where reconstruction is expensive). It does not close the gap
with RobinHood's lookup speed, and isn't trying to -- caching amortizes
reconstruction cost across repeats of the *same* symbol; RobinHood avoids
reconstruction cost entirely, for every symbol, at the price of the memory
compression BudgetSym exists to provide. Two different, non-competing
answers to "does compression hurt lookup", both measured honestly rather
than only reporting the one that flatters BudgetSym.
