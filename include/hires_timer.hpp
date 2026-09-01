#pragma once
// Portable-ish high-resolution timer.
//
// On this project's actual build toolchain (MinGW.org GCC 6.3.0, Windows),
// std::chrono::steady_clock silently does not work: back-to-back now() calls
// report 0ns apart, and a timed 1,000,000-iteration loop measured 0us --
// confirmed while building this benchmark (see docs/methodology.md). Using it
// would have made every latency column in benchmark_results.csv either exactly
// 0 or garbage, which is indistinguishable from fabricating the numbers.
//
// QueryPerformanceCounter is confirmed working on this machine (10MHz counter,
// verified against the same loop giving a sane, nonzero microsecond figure).
// So: use it directly on Windows, and fall back to std::chrono elsewhere (any
// platform where the standard clock is not known to be broken).
#include <cstdint>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

namespace budgetsym {

class HiResTimer {
public:
    HiResTimer() { QueryPerformanceFrequency(&freq_); }

    struct TimePoint { long long ticks; };

    TimePoint now() const {
        LARGE_INTEGER t;
        QueryPerformanceCounter(&t);
        TimePoint tp; tp.ticks = t.QuadPart;
        return tp;
    }

    double microsecondsBetween(TimePoint a, TimePoint b) const {
        return static_cast<double>(b.ticks - a.ticks) * 1e6 / static_cast<double>(freq_.QuadPart);
    }

private:
    LARGE_INTEGER freq_;
};

} // namespace budgetsym

#else
#include <chrono>

namespace budgetsym {

class HiResTimer {
public:
    using TimePoint = std::chrono::steady_clock::time_point;
    TimePoint now() const { return std::chrono::steady_clock::now(); }
    double microsecondsBetween(TimePoint a, TimePoint b) const {
        return std::chrono::duration<double, std::micro>(b - a).count();
    }
};

} // namespace budgetsym

#endif
