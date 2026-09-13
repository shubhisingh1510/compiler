// Reads results/algorithm_comparison.csv fresh from disk on every request --
// live-connected to whatever ./algorithm_benchmark.exe last wrote. See
// docs/algorithm_comparison.md for the 5-way (BudgetSym-FNV1a/Murmur3/DJB2,
// RobinHood, Trie) comparison this backs.
import { NextResponse } from "next/server";
import fs from "fs";
import { parseCsv, toNumberRow } from "../../../lib/csv";
import { resultsCsvPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

const NUMERIC_FIELDS = [
  "symbols", "memory_bytes", "memory_per_symbol", "compression_ratio", "slack_bytes",
  "insert_us", "lookup_success_us", "lookup_failure_us",
];

export async function GET() {
  const csvPath = resultsCsvPath("algorithm_comparison.csv");
  if (!csvPath) {
    return NextResponse.json({ available: false, rows: [], message: "results/algorithm_comparison.csv not found. Run ./algorithm_benchmark.exe from the repo root to generate it." });
  }
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text).map((r) => toNumberRow(r, NUMERIC_FIELDS));
  return NextResponse.json({ available: true, rows, sourcePath: csvPath });
}
