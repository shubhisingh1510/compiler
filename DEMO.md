# DEMO.md -- 5-Minute Faculty Review Plan

## Before you start

```bash
./build.sh                 # rebuilds everything + reruns benchmark/ablation/plots fresh
```
Have `figures/compression_ratio.png` and `figures/ablation_memory.png` open,
and a terminal in the repo root ready for `./budget_sym_demo.exe`.

---

## MINUTE 1 -- Problem

"Embedded compilation environments have constrained memory, while
conventional symbol tables can carry significant string, metadata, and
indexing overhead. A compiler for a memory-bounded target can't always afford
a conventional table's peak memory, but it also can't uniformly pay a
compression scheme's lookup-time cost for every identifier -- including ones
on a hot path."

## MINUTE 2 -- Existing approaches and their limitation

Show the three established techniques (all actually implemented and
benchmarked here, not just described):
- Conventional hash table (`ConventionalSymbolTable`) -- full string copy per symbol.
- String interning (`InternedSymbolTable`) -- shared, refcounted pool; only
  saves memory on exact repeats. Measured: ~1.05x-1.07x vs conventional
  across every dataset (`results/benchmark_results.csv`).
- Compressed/trie-based dictionaries -- front-coding; compresses uniformly,
  doesn't decide per-entry.

**Limitation, stated plainly:** none of these make a representation decision
using a *unified compiler-aware memory-budget policy* that also reacts to
runtime behavior.

## MINUTE 3 -- Our proposed architecture

Show `docs/architecture.md`'s Mermaid diagram (renders directly in most
Markdown viewers / GitHub):

```
Memory Pressure + Scope/Lifetime + Access Frequency + Identifier Characteristics
                              |
                 Adaptive Representation Policy
                              |
                  INLINE / INTERNED / COMPRESSED
```

State the novelty claim precisely (from `docs/novelty.md`): not the three
representations themselves, but the unified policy choosing between them per
symbol, plus post-insertion promotion driven by real access counts.

## MINUTE 4 -- Live demonstration

```bash
./budget_sym_demo.exe
```

Narrate as it runs -- every line is real, computed output, not scripted text:
1. **Symbol insertion + representation decisions** -- 6 identifiers, watch
   different ones land on INLINE / INTERNED / COMPRESSED.
2. **Memory Saved vs Conventional / Compression Ratio** -- computed by
   actually building a `ConventionalSymbolTable` on the same 6 symbols and
   diffing tracked memory.
3. **Nested scope** -- 20 symbols inserted into a child scope, then
   `exitScope()`: watch `Symbols released` and `Memory reclaimed` print real,
   nonzero numbers.
4. **Adaptive promotion** -- 3 long, prefix-similar identifiers inserted
   (some land COMPRESSED), then the last one is looked up 3x; watch it
   actually flip to INTERNED (`representationOf()` re-queried and printed
   after the accesses, not just asserted).
5. **Lookup test** -- FOUND / FOUND / NOT FOUND, including a genuine miss.

## MINUTE 5 -- Experimental plan

Show, in order:
1. `figures/compression_ratio.png` -- BudgetSym beats both baselines on
   every one of 8 datasets (1.24x-2.37x vs conventional).
2. `figures/lookup_latency.png` -- the honest cost: BudgetSym's lookup is
   slower than both baselines on most datasets. State this unprompted.
3. `figures/ablation_memory.png` -- `BudgetSym-Full` (33,581 bytes) vs
   `BudgetSym-NoAdaptiveSelection` (50,642 bytes, i.e. "just always intern")
   on the identical fixed workload: a controlled measurement of what the
   adaptive policy itself buys, isolated from the other mechanisms.
4. Mention `docs/experiment_plan.md`'s next steps (multi-seed significance
   testing, real compiler-traffic dataset) as the honest "this is a
   prototype, here's what would make it rigorous" close.

---

## If asked anything not covered above

`docs/faculty_questions.md` has pre-written, technically honest answers to:
novelty, "why not a trie", "why not just interning", how memory is measured,
whether compression hurts lookup, embedded relevance, how we'd prove it's
better, and next steps.
