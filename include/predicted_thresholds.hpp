#pragma once
// BUDGET-SYM Review-2 extension: hardcoded Ridge-regression coefficients
// trained offline by scripts/train_threshold_predictor.py against a Python
// port of BudgetSym's decide()/cost model over 300 synthetic workloads.
// No sklearn dependency at runtime -- this file is generated once and
// committed; regenerate by re-running the training script.
//
// GENERATED FILE -- do not hand-edit. See scripts/train_threshold_predictor.py.
#include <algorithm>
#include "common.hpp"
#include "workload_profiler.hpp"

namespace budgetsym {

struct ThresholdPredictor {
    template <typename T>
    static T clampVal(double v, T lo, T hi) {
        if (v < static_cast<double>(lo)) return lo;
        if (v > static_cast<double>(hi)) return hi;
        return static_cast<T>(v);
    }

    static PolicyConfig predict(const WorkloadFeatures& f) {
        PolicyConfig c;
        c.inlineMaxLen = clampVal<size_t>(0.10396718 * f.meanNameLength + -0.99661499 * f.prefixSimilarityCoeff + -3.56182184 * f.repeatRate + -0.09621722 * f.scopeDepthVariance + -0.07302157 * f.nameEntropy + (15.62812561), static_cast<size_t>(6), static_cast<size_t>(20));
        c.compressMinLen = clampVal<size_t>(-0.28230726 * f.meanNameLength + -4.54439013 * f.prefixSimilarityCoeff + -1.16080491 * f.repeatRate + 0.00558958 * f.scopeDepthVariance + -0.13043574 * f.nameEntropy + (14.86787901), static_cast<size_t>(4), static_cast<size_t>(20));
        c.lowPressureThreshold = clampVal<double>(0.00000000 * f.meanNameLength + 0.00000000 * f.prefixSimilarityCoeff + -0.00000000 * f.repeatRate + 0.00000000 * f.scopeDepthVariance + -0.00000000 * f.nameEntropy + (0.30000000), static_cast<double>(0.1), static_cast<double>(0.7));
        c.highPressureThreshold = clampVal<double>(0.00000000 * f.meanNameLength + 0.00000000 * f.prefixSimilarityCoeff + -0.00000000 * f.repeatRate + 0.00000000 * f.scopeDepthVariance + -0.00000000 * f.nameEntropy + (0.70000000), static_cast<double>(0.5), static_cast<double>(0.95));
        c.hotAccessThreshold = clampVal<size_t>(0.00000000 * f.meanNameLength + 0.00000000 * f.prefixSimilarityCoeff + 0.00000000 * f.repeatRate + 0.00000000 * f.scopeDepthVariance + 0.00000000 * f.nameEntropy + (2.00000000), static_cast<size_t>(1), static_cast<size_t>(10));
        c.prefixSimilarityMinShared = clampVal<size_t>(-0.04393651 * f.meanNameLength + -0.67961064 * f.prefixSimilarityCoeff + 0.93799565 * f.repeatRate + 0.01477856 * f.scopeDepthVariance + 0.06262092 * f.nameEntropy + (3.54283094), static_cast<size_t>(1), static_cast<size_t>(10));
        return c;
    }
};

} // namespace budgetsym
