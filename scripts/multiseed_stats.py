#!/usr/bin/env python3
"""Aggregate results/multiseed_raw.csv into means, 95% CIs, and Welch's
t-test p-values comparing BudgetSym against Conventional and Interned.

No scipy in this project's venv (see requirements.txt), so both the
t-distribution critical values and the two-tailed p-value are computed by
hand: the critical values are hardcoded (valid only for df=29, i.e. n=30
per group -- see comment below), and the p-value uses a hand-rolled
regularized incomplete beta function in place of scipy.stats.t.sf.
"""
import csv
import math
from collections import defaultdict

RAW_PATH = "results/multiseed_raw.csv"
SUMMARY_PATH = "results/multiseed_summary.csv"

N = 30  # fixed sample size per (dataset, implementation) group

# Two-tailed Student's t critical values for df = N-1 = 29 ONLY. These are
# hardcoded because this script always compares exactly 30-seed groups; if N
# ever changes, these must be recomputed (e.g. via a t-table or scipy on a
# machine that has it) -- there is no general inverse-t solver here.
T_CRIT_025 = 2.045  # two-tailed alpha=0.05 -> 95% CI multiplier
T_CRIT_005 = 2.756  # two-tailed alpha=0.01 -> p<0.01 significance threshold (unused directly;
                      # kept for documentation/reference, actual p<0.01 check uses the real p-value below)


def mean(xs):
    return sum(xs) / len(xs)


def sample_var(xs, m=None):
    if m is None:
        m = mean(xs)
    n = len(xs)
    return sum((x - m) ** 2 for x in xs) / (n - 1)


# ---------------------------------------------------------------------------
# Hand-rolled regularized incomplete beta function, used to convert a Welch
# t-statistic + degrees-of-freedom into a real two-tailed p-value without
# scipy.stats.t.sf. Standard Numerical-Recipes-style betacf/betai algorithm:
# betai(a, b, x) = I_x(a, b) via a continued-fraction expansion of the
# incomplete beta integral (Lentz's method), with the log-Beta prefactor from
# math.lgamma. The two-tailed p-value for a t-statistic with df degrees of
# freedom is betai(df/2, 0.5, df/(df + t^2)).
def _betacf(a, b, x, max_iter=200, eps=3e-12):
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < 1e-30:
        d = 1e-30
    d = 1.0 / d
    h = d
    for m in range(1, max_iter + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


def _betai(a, b, x):
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    log_bt = (math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
              + a * math.log(x) + b * math.log(1.0 - x))
    bt = math.exp(log_bt)
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * _betacf(a, b, x) / a
    else:
        return 1.0 - bt * _betacf(b, a, 1.0 - x) / b


def two_tailed_p_from_t(t_stat, df):
    """Two-tailed p-value for a t-statistic with `df` degrees of freedom,
    replacing scipy.stats.t.sf(abs(t), df) * 2."""
    x = df / (df + t_stat * t_stat)
    return _betai(df / 2.0, 0.5, x)


def welch_t_test(xs, ys):
    """Welch's t-test: returns (t_statistic, df, two_tailed_p_value)."""
    n1, n2 = len(xs), len(ys)
    m1, m2 = mean(xs), mean(ys)
    v1, v2 = sample_var(xs, m1), sample_var(ys, m2)
    se2 = v1 / n1 + v2 / n2
    t_stat = (m1 - m2) / math.sqrt(se2) if se2 > 0 else 0.0
    if se2 > 0:
        df = (se2 ** 2) / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
    else:
        df = n1 + n2 - 2
    p = two_tailed_p_from_t(abs(t_stat), df)
    return t_stat, df, p


def main():
    rows = defaultdict(list)  # (dataset, implementation) -> [compression_ratio,...]
    with open(RAW_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row["dataset"], row["implementation"])
            rows[key].append(float(row["compression_ratio"]))

    datasets = sorted({k[0] for k in rows})
    impls = ["Conventional", "Interned", "BudgetSym"]

    out_rows = []
    for ds in datasets:
        conv = rows[(ds, "Conventional")]
        interned = rows[(ds, "Interned")]
        budget = rows[(ds, "BudgetSym")]
        assert len(conv) == N and len(interned) == N and len(budget) == N, \
            f"expected {N} samples per group for {ds}, got {len(conv)}/{len(interned)}/{len(budget)}"

        for impl, vals in (("Conventional", conv), ("Interned", interned), ("BudgetSym", budget)):
            m = mean(vals)
            sd = math.sqrt(sample_var(vals, m))
            half_width = T_CRIT_025 * sd / math.sqrt(N)
            ci_low = m - half_width
            ci_high = m + half_width

            if impl == "BudgetSym":
                _, _, p_vs_conv = welch_t_test(budget, conv)
                _, _, p_vs_interned = welch_t_test(budget, interned)
                significant = p_vs_conv < 0.01
                out_rows.append([
                    ds, impl, m, ci_low, ci_high,
                    f"{p_vs_conv:.6g}", f"{p_vs_interned:.6g}", str(significant),
                ])
            else:
                out_rows.append([ds, impl, m, ci_low, ci_high, "", "", ""])

    with open(SUMMARY_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "dataset", "implementation", "mean_compression_ratio",
            "ci95_low", "ci95_high", "p_value_vs_conventional",
            "p_value_vs_interned", "significant_at_p01",
        ])
        for r in out_rows:
            writer.writerow(r)

    print(f"Wrote {SUMMARY_PATH} ({len(out_rows)} data rows)")


if __name__ == "__main__":
    main()
