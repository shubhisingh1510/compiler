# Robin Hood Open Addressing (Task 2: Hashing)

`include/robinhood_symbol_table.hpp` -- a new comparison baseline, not a
modification to BudgetSym. It applies Robin Hood open addressing the same
way `ConventionalSymbolTable` applies `std::unordered_map`: one table per
scope, keyed directly by the full identifier string, no interning or
compression. This isolates *table structure* as the only variable against
Conventional, rather than bundling a new hash table with a
representation-selection policy the way BudgetSym does.

## Mechanism

Linear-probing open addressing where an element that has probed farther
from its "home" slot (`hash & capacityMask`) than the element currently
occupying a candidate slot **displaces** it and continues probing with the
displaced element -- "stealing" from the entry that's closer to home to give
to the one probing farther. Two consequences:

1. **Early-exit on miss**: if the search has already probed farther than the
   `probeDistance` recorded in the current slot, the key cannot exist
   anywhere farther out -- it would have displaced that slot on insert
   otherwise. `find()` uses this to reject an absent key without scanning to
   an empty slot.
2. **No pointer-chasing**: every entry lives inline in one contiguous
   `std::vector<Slot>`, not one heap node per chain-bucket entry like
   `std::unordered_map`. This -- not a faster hash function -- is the actual
   mechanism behind Robin Hood's lookup speed in `results/algorithm_comparison.csv`
   (consistently the fastest lookup of every algorithm compared, by a wide
   margin, consistently: roughly `0.03-0.07us` vs. BudgetSym's `0.25-2.0us`
   across every dataset and every rerun performed while building this --
   see `docs/algorithm_comparison.md` for why exact figures shift between
   runs on a shared machine but this specific ranking never did).

## What it costs: slack memory, reported honestly and separately

Every slot in the table -- occupied or not -- is a live `std::string` +
metadata sitting in a preallocated array. A chaining table's empty bucket is
a null pointer; an open-addressing table's empty slot is a full struct.
Concretely, at the ~0.70 max load factor this implementation resizes at,
roughly 30-45% of the array's slots are empty at any time in steady state
(more right after a resize).

`slackBytes()` reports this separately from `tracker()`/`compression_ratio`
-- **not folded into the headline tracked-memory number**, so that number
stays comparable across every implementation using the same
`entryCost()`-style formula project-wide (see `docs/methodology.md`'s cost
table). On `high-prefix-similarity` (2000 identifiers): occupied-entry cost
is `168090` bytes, `slackBytes()` is `134144` -- the empty-slot overhead is
**80% as large as the actual data**. This is the real, honestly-reported
price of Robin Hood's lookup speed: it is not a free win, it trades memory
(that this project's entire other axis exists to minimize) for latency.

## What is deliberately not implemented

No deletion (no tombstones, no backward-shift delete). This project only
ever needs whole-scope removal -- `exitScope()` drops the entire table for
that scope, exactly like `ConventionalSymbolTable` does -- so there is no
exercised code path that would call a single-key delete from a still-live
table. Implementing backward-shift deletion (the standard correct approach
for Robin Hood tables, since naive tombstoning breaks the probe-distance
invariant that makes lookup's early-exit correct) would be real code with
zero test coverage from this project's own workloads -- left out rather than
included untested.
