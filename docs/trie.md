# Shared Trie Storage (Task 2: Compression)

`include/trie_symbol_table.hpp` -- a second new baseline, structurally
different from BudgetSym's front-coding rather than a tuning of it.

## Why this is a different technique, not front-coding with extra steps

BudgetSym's COMPRESSED representation (`include/budget_sym.hpp`,
`insertCompressed()`) front-codes each identifier against the **one**
identifier inserted immediately before it in the COMPRESSED chain --
deliberately, to mirror a real compiler processing declarations in source
order (see that file's top comment). A trie shares prefixes across **every**
identifier ever inserted, project-wide, independent of insertion order:
`"temperatureSensorOffset"` inserted right after `"networkInterfaceBuffer"`
shares nothing with it under front-coding, but a much later
`"temperatureSensorMax"` still reuses the exact path nodes the first
identifier laid down, however many unrelated identifiers came between them.
Strictly more powerful sharing -- at a real, different cost.

## Cost model

Each new trie node costs `kNewNodeOverhead` (24 bytes: one
`unordered_map<char,int>` child-map entry plus node bookkeeping), charged
only when a node is actually created, not when an existing branch is
reused. A node becoming terminal (a full identifier ends there) costs a
separate, one-time `kTerminalMarkOverhead` (8 bytes). An identifier whose
entire path already exists character-for-character costs only the terminal
mark, regardless of when or by what earlier identifier that path was built.

The direct consequence, measured in `results/algorithm_comparison.csv`: a
**per-character node costs more than front-coding's raw suffix byte** when
there is nothing to share, so on datasets with little global prefix overlap
the trie's compression ratio is *worse* than Conventional's baseline, not
better --

| Dataset | Trie compression_ratio | BudgetSym-FNV1a compression_ratio |
|---|---|---|
| high-prefix-similarity | 1.07x | 2.37x |
| small | 0.13x | 1.65x |
| medium | 0.26x | 1.63x |
| large | 0.29x | 1.64x |
| random-identifiers | 0.20x | 1.34x |
| memory-stress | 0.14x | 1.38x |

(BudgetSym's numbers above are higher than an earlier pre-merge measurement
of the same datasets -- see `docs/algorithm_comparison.md`'s note on the
Review-2 ML threshold predictor now adjusting `PolicyConfig` per-workload
after the first 100 inserts. Trie has no equivalent adaptive mechanism, so
its numbers are unaffected by that change.)

Only `high-prefix-similarity` -- built specifically so identifiers repeat
long shared prefixes -- gets a trie ratio above 1.0x, and even there
front-coding still wins on memory. **The trie loses the memory comparison
in every dataset tested.** Reported as such, not glossed over: this is
exactly the kind of "new technique doesn't automatically beat the existing
one" result this project's own rule (never let a chart imply more than what
was measured) exists for.

## Where the trie wins instead: lookup, especially misses

A trie needs no reconstruct-then-compare step at all. Walking the query
string's characters down existing child pointers *is* the equality check --
if every character has a matching child and the walk lands exactly on a
terminal node, the string is present; there is nothing to reconstruct
afterward. This is a structural answer to
`docs/faculty_questions.md`'s "Does compression hurt lookup?" that's
different in kind from `docs/caching.md`'s answer (make reconstruction
cheaper for repeats) -- this avoids ever needing reconstruction, on every
lookup, hit or miss.

Measured effect: Trie's `lookup_failure_us` is consistently the lowest or
second-lowest of every algorithm compared (e.g. `high-prefix-similarity`:
Trie `0.003-0.014us` across repeated runs vs. BudgetSym-FNV1a's
`0.06-0.15us`) -- an absent identifier is typically rejected within the
first character or two that has no matching child, without ever touching a
hash or a reconstruction. This ranking held on every rerun performed while
building this. `lookup_success_us` is a genuine, if noisier, improvement
over BudgetSym on most datasets, but still behind RobinHood and
Conventional, since walking N characters through N separate
`unordered_map<char,int>` lookups has real per-character overhead that a
single string-keyed hash lookup doesn't pay.

**A claim this work almost made, and didn't**: an early run showed Trie's
`lookup_success_us` on `random-identifiers` (long, no-shared-prefix
strings) higher than all three BudgetSym variants, which read like a clean
story -- BudgetSym's adaptive policy can fall back to a cheap
representation for identifiers that don't compress well, while a trie has
no equivalent escape hatch. Repeating the run three more times showed Trie
faster than BudgetSym twice and slower once, on the identical dataset and
code -- the "exception" was single-run timing noise on a shared,
non-isolated machine, not a real effect. Reported here specifically because
it's the kind of plausible-sounding, mechanism-backed story that's easy to
believe on one measurement and wrong to publish without checking it
reproduces; `docs/future_work.md` item 4 (no repeated-trial statistics) is
exactly the gap that let this look like a finding at first.

## What is deliberately not implemented

Scope-exit reclamation only removes the **terminal mark** for a
now-unreferenced identifier (refcounted, same pattern as
`InternedSymbolTable`'s pool and BudgetSym's COMPRESSED chain interior
nodes -- see `docs/future_work.md` item 1 for the established precedent this
follows). The path nodes leading to that terminal are never removed, even if
provably unused by everything else, because confirming "no other live
identifier's path passes through this node" would require either
reference-counting every node (not just terminals) or a full mark-and-sweep
pass -- neither implemented here. Stated as a real limitation, not hidden:
long-running use would accumulate dead path nodes the same way BudgetSym's
`compPool_` and `InternedSymbolTable`'s pool already do.
