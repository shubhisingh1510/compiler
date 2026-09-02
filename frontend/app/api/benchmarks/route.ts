// Reads results/benchmark_results.csv fresh from disk on every request --
// live-connected to whatever ./benchmark.exe last wrote, not a build-time
// snapshot. If the file is missing, returns an honest empty state (never
// fabricated rows) so the UI can show "No benchmark data available."
import { NextResponse } from "next/server";
import fs from "fs";
import { parseCsv, toNumberRow } from "../../../lib/csv";
import { resultsCsvPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

const NUMERIC_FIELDS = [
  "symbols", "memory_bytes", "memory_per_symbol", "compression_ratio",
  "insert_us", "lookup_success_us", "lookup_failure_us", "scope_enter_us", "scope_exit_us",
];

export async function GET() {
  const csvPath = resultsCsvPath("benchmark_results.csv");
  if (!csvPath) {
    return NextResponse.json({ available: false, rows: [], message: "results/benchmark_results.csv not found. Run ./benchmark.exe from the repo root to generate it." });
  }
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text).map((r) => toNumberRow(r, NUMERIC_FIELDS));
  return NextResponse.json({ available: true, rows, sourcePath: csvPath });
}
