# Real-world corpus evaluation setup

This sandbox has no internet access, so the real FreeRTOS/Arduino/Zephyr
source trees are not available here. `corpus_bench.exe` and
`scripts/extract_identifiers.py` are already built and unit-verified against
small hand-made fixtures -- run the steps below on your own machine (with
internet access) to produce real corpus results.

## 1. Clone the corpora

```
git clone --depth 1 https://github.com/FreeRTOS/FreeRTOS-Kernel corpora/freertos
git clone --depth 1 https://github.com/arduino/ArduinoCore-avr corpora/arduino-core
git clone --depth 1 --filter=blob:none --sparse https://github.com/zephyrproject-rtos/zephyr corpora/zephyr
```

Zephyr's full tree is huge -- restrict its checkout to a couple of
representative subdirectories after cloning:

```
cd corpora/zephyr
git sparse-checkout set kernel drivers
cd ../..
```

`corpora/` is gitignored (see `.gitignore`) since this is vendored
third-party source that should not be committed to this repo.

## 2. Extract identifiers

For each corpus, tokenize its `.c`/`.h` files into a plain identifier list:

```
python scripts/extract_identifiers.py corpora/freertos results/corpus_ids_freertos.txt
python scripts/extract_identifiers.py corpora/arduino-core results/corpus_ids_arduino.txt
python scripts/extract_identifiers.py corpora/zephyr results/corpus_ids_zephyr.txt
```

Each run prints a summary (files scanned, raw tokens, tokens kept after
filtering C keywords) to stdout.

## 3. Run the benchmark

```
./corpus_bench.exe results/corpus_ids_freertos.txt freertos
./corpus_bench.exe results/corpus_ids_arduino.txt arduino-core
./corpus_bench.exe results/corpus_ids_zephyr.txt zephyr
```

Each invocation appends 3 rows (Conventional, Interned, BudgetSym) to
`results/corpus_results.csv`, using the same 11-column schema as
`results/benchmark_results.csv`, so corpus rows are directly comparable to
the synthetic-dataset rows. If the file doesn't exist yet, the header is
written automatically on the first call.

An optional third argument overrides the default 64MB budget, e.g.:

```
./corpus_bench.exe results/corpus_ids_zephyr.txt zephyr 33554432
```

## Error handling

If `<identifiers_file>` is missing or empty, `corpus_bench.exe` prints a
clear error to stderr and exits non-zero without touching
`results/corpus_results.csv`. `build.sh`'s corpus block checks for
`corpora/<name>` before running this pipeline and skips with a clear message
if the directory is absent, rather than failing the whole build.
