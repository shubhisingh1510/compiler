#!/usr/bin/env python3
"""Generate figures from results/benchmark_results.csv and
results/ablation_results.csv. Every chart below reads real, measured numbers
from those CSVs -- nothing here is a placeholder or hand-typed value."""
import csv
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, "results")
FIGURES = os.path.join(ROOT, "figures")
os.makedirs(FIGURES, exist_ok=True)

IMPL_COLORS = {"Conventional": "#9aa5b1", "Interned": "#5b8def", "BudgetSym": "#2fb380"}
IMPL_ORDER = ["Conventional", "Interned", "BudgetSym"]


def load_benchmark():
    path = os.path.join(RESULTS, "benchmark_results.csv")
    if not os.path.exists(path):
        print(f"ERROR: {path} not found -- run ./src/benchmark.exe first.", file=sys.stderr)
        sys.exit(1)
    rows = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    return rows


def datasets_in_order(rows):
    seen = []
    for r in rows:
        if r["dataset"] not in seen:
            seen.append(r["dataset"])
    return seen


def grouped_bar(rows, value_key, title, ylabel, filename, value_fmt="{:.0f}"):
    dsets = datasets_in_order(rows)
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = range(len(dsets))
    width = 0.26
    for i, impl in enumerate(IMPL_ORDER):
        vals = []
        for d in dsets:
            match = [r for r in rows if r["dataset"] == d and r["implementation"] == impl]
            vals.append(float(match[0][value_key]) if match else 0.0)
        positions = [xi + (i - 1) * width for xi in x]
        bars = ax.bar(positions, vals, width, label=impl, color=IMPL_COLORS[impl])
        for b, v in zip(bars, vals):
            ax.annotate(value_fmt.format(v), (b.get_x() + b.get_width() / 2, b.get_height()),
                        ha="center", va="bottom", fontsize=7, rotation=90, xytext=(0, 3),
                        textcoords="offset points")
    ax.set_xticks(list(x))
    ax.set_xticklabels(dsets, rotation=25, ha="right")
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    out = os.path.join(FIGURES, filename)
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"wrote {out}")


def lookup_latency_chart(rows):
    dsets = datasets_in_order(rows)
    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5), sharey=False)
    for ax, key, title in zip(axes, ["lookup_success_us", "lookup_failure_us"],
                               ["Lookup latency -- hit", "Lookup latency -- miss"]):
        x = range(len(dsets))
        width = 0.26
        for i, impl in enumerate(IMPL_ORDER):
            vals = []
            for d in dsets:
                match = [r for r in rows if r["dataset"] == d and r["implementation"] == impl]
                vals.append(float(match[0][key]) if match else 0.0)
            positions = [xi + (i - 1) * width for xi in x]
            ax.bar(positions, vals, width, label=impl, color=IMPL_COLORS[impl])
        ax.set_xticks(list(x))
        ax.set_xticklabels(dsets, rotation=25, ha="right", fontsize=8)
        ax.set_ylabel("microseconds / lookup")
        ax.set_title(title)
        ax.grid(axis="y", alpha=0.3)
    axes[0].legend()
    fig.suptitle("Lookup Latency: Conventional vs Interned vs BudgetSym")
    fig.tight_layout()
    out = os.path.join(FIGURES, "lookup_latency.png")
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"wrote {out}")


def ablation_chart():
    path = os.path.join(RESULTS, "ablation_results.csv")
    if not os.path.exists(path):
        print(f"WARNING: {path} not found, skipping ablation chart", file=sys.stderr)
        return
    rows = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    variants = [r["variant"] for r in rows]
    mem = [float(r["memory_bytes"]) for r in rows]
    promo = [int(r["promotions"]) for r in rows]

    fig, ax1 = plt.subplots(figsize=(10, 5.5))
    colors = ["#2fb380", "#e08e45", "#c74e4e", "#5b8def"]
    bars = ax1.bar(variants, mem, color=colors)
    for b, v in zip(bars, mem):
        ax1.annotate(f"{v:.0f}B", (b.get_x() + b.get_width() / 2, b.get_height()),
                     ha="center", va="bottom", fontsize=9, xytext=(0, 3), textcoords="offset points")
    ax1.set_ylabel("Tracked Memory (bytes)")
    ax1.set_title("Ablation: Tracked Memory by Disabled Mechanism (same fixed workload)")
    ax1.tick_params(axis="x", rotation=15)
    ax1.grid(axis="y", alpha=0.3)

    for i, p in enumerate(promo):
        ax1.annotate(f"{p} promotions", (i, mem[i] / 2), ha="center", va="center",
                     fontsize=8, color="white" if mem[i] > 5000 else "black")

    fig.tight_layout()
    out = os.path.join(FIGURES, "ablation_memory.png")
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"wrote {out}")


def load_csv(filename):
    path = os.path.join(RESULTS, filename)
    if not os.path.exists(path):
        print(f"WARNING: {path} not found, skipping its chart(s)", file=sys.stderr)
        return None
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def cache_comparison_chart():
    """Does the Review-2 LRU lookup cache actually reduce lookup latency?
    Two panels: cold (cache cannot help, shows overhead) vs. repeated
    hot-subset access (what the cache targets) -- see docs/caching.md."""
    rows = load_csv("cache_benchmark_results.csv")
    if rows is None:
        return
    dsets = []
    for r in rows:
        if r["dataset"] not in dsets:
            dsets.append(r["dataset"])
    colors = {"cache-off": "#9aa5b1", "cache-on": "#2fb380"}

    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    for ax, key, title in zip(
        axes, ["cold_lookup_us", "repeated_lookup_us"],
        ["Cold lookup (cache cannot help -- shows bookkeeping overhead)",
         "Repeated hot-subset lookup (what the cache targets)"],
    ):
        x = range(len(dsets))
        width = 0.35
        for i, variant in enumerate(["cache-off", "cache-on"]):
            vals = []
            for d in dsets:
                match = [r for r in rows if r["dataset"] == d and r["variant"] == variant]
                vals.append(float(match[0][key]) if match else 0.0)
            positions = [xi + (i - 0.5) * width for xi in x]
            bars = ax.bar(positions, vals, width, label=variant, color=colors[variant])
            for b, v in zip(bars, vals):
                ax.annotate(f"{v:.3f}", (b.get_x() + b.get_width() / 2, b.get_height()),
                            ha="center", va="bottom", fontsize=7, rotation=90, xytext=(0, 3),
                            textcoords="offset points")
        ax.set_xticks(list(x))
        ax.set_xticklabels(dsets, rotation=25, ha="right", fontsize=8)
        ax.set_ylabel("microseconds / lookup")
        ax.set_title(title, fontsize=10)
        ax.grid(axis="y", alpha=0.3)
    axes[0].legend()
    fig.suptitle("LRU Lookup Cache: Latency Before vs. After (BudgetSym)")
    fig.tight_layout()
    out = os.path.join(FIGURES, "cache_latency.png")
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"wrote {out}")


ALGO_COLORS = {
    "BudgetSym-FNV1a": "#2fb380", "BudgetSym-Murmur3": "#3f9142", "BudgetSym-DJB2": "#6bb64f",
    "RobinHood": "#5b8def", "Trie": "#e08e45",
}
ALGO_ORDER = ["BudgetSym-FNV1a", "BudgetSym-Murmur3", "BudgetSym-DJB2", "RobinHood", "Trie"]


def algorithm_comparison_chart():
    """Hashing backends (FNV-1a / MurmurHash3 / DJB2 -- same BudgetSym
    policy, different index hash) and storage strategies (RobinHood open
    addressing, Trie) compared on memory and lookup latency -- see
    docs/algorithm_comparison.md."""
    rows = load_csv("algorithm_comparison.csv")
    if rows is None:
        return
    dsets = []
    for r in rows:
        if r["dataset"] not in dsets:
            dsets.append(r["dataset"])

    def grouped(value_key, title, ylabel, filename):
        fig, ax = plt.subplots(figsize=(12, 5.5))
        x = range(len(dsets))
        width = 0.16
        for i, algo in enumerate(ALGO_ORDER):
            vals = []
            for d in dsets:
                match = [r for r in rows if r["dataset"] == d and r["algorithm"] == algo]
                vals.append(float(match[0][value_key]) if match else 0.0)
            positions = [xi + (i - 2) * width for xi in x]
            ax.bar(positions, vals, width, label=algo, color=ALGO_COLORS[algo])
        ax.set_xticks(list(x))
        ax.set_xticklabels(dsets, rotation=25, ha="right", fontsize=8)
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        ax.legend(fontsize=8)
        ax.grid(axis="y", alpha=0.3)
        fig.tight_layout()
        out = os.path.join(FIGURES, filename)
        fig.savefig(out, dpi=150)
        plt.close(fig)
        print(f"wrote {out}")

    grouped("compression_ratio", "Algorithm Comparison: Compression Ratio vs. Conventional",
            "ratio (higher = better)", "algorithm_compression_ratio.png")
    grouped("lookup_success_us", "Algorithm Comparison: Lookup Latency (hit)",
            "microseconds / lookup", "algorithm_lookup_latency.png")


def main():
    rows = load_benchmark()
    grouped_bar(rows, "memory_bytes", "Tracked Memory by Implementation", "bytes",
                "memory_usage.png", "{:.0f}")
    grouped_bar(rows, "memory_per_symbol", "Tracked Memory per Symbol", "bytes/symbol",
                "memory_per_symbol.png", "{:.1f}")
    grouped_bar(rows, "compression_ratio", "Compression Ratio vs Conventional Baseline",
                "ratio (higher = better)", "compression_ratio.png", "{:.2f}x")
    lookup_latency_chart(rows)
    ablation_chart()
    cache_comparison_chart()
    algorithm_comparison_chart()
    print("\nAll figures generated from measured CSV data in results/.")


if __name__ == "__main__":
    main()
