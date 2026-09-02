// Reads results/ablation_results.csv fresh from disk -- same honesty rule as
// /api/benchmarks: real file or an explicit empty state, never fabricated.
import { NextResponse } from "next/server";
import fs from "fs";
import { parseCsv, toNumberRow } from "../../../lib/csv";
import { resultsCsvPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

const NUMERIC_FIELDS = ["symbols", "memory_bytes", "memory_per_symbol", "promotions", "insert_us", "lookup_us", "bytes_reclaimed_total"];

export async function GET() {
  const csvPath = resultsCsvPath("ablation_results.csv");
  if (!csvPath) {
    return NextResponse.json({ available: false, rows: [], message: "results/ablation_results.csv not found. Run ./ablation.exe from the repo root to generate it." });
  }
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text).map((r) => toNumberRow(r, NUMERIC_FIELDS));
  return NextResponse.json({ available: true, rows, sourcePath: csvPath });
}
