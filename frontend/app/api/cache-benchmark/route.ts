// Reads results/cache_benchmark_results.csv fresh from disk on every
// request -- live-connected to whatever ./cache_benchmark.exe last wrote.
// See docs/caching.md for what cold_lookup_us / repeated_lookup_us mean and
// why they're reported separately rather than as one blended number.
import { NextResponse } from "next/server";
import fs from "fs";
import { parseCsv, toNumberRow } from "../../../lib/csv";
import { resultsCsvPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

const NUMERIC_FIELDS = [
  "symbols", "insert_us", "cold_lookup_us", "repeated_lookup_us",
  "cache_hit_rate", "speedup_vs_no_cache_x",
];

export async function GET() {
  const csvPath = resultsCsvPath("cache_benchmark_results.csv");
  if (!csvPath) {
    return NextResponse.json({ available: false, rows: [], message: "results/cache_benchmark_results.csv not found. Run ./cache_benchmark.exe from the repo root to generate it." });
  }
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text).map((r) => toNumberRow(r, NUMERIC_FIELDS));
  return NextResponse.json({ available: true, rows, sourcePath: csvPath });
}
