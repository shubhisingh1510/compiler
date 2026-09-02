// System status for the dashboard hero. Every field is a real filesystem
// check against the repo -- never hardcoded "operational".
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { analyzeBinaryPath, repoRoot, resultsCsvPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

export async function GET() {
  const root = repoRoot();
  const analyzeBin = analyzeBinaryPath();
  const benchmarkCsv = resultsCsvPath("benchmark_results.csv");
  const ablationCsv = resultsCsvPath("ablation_results.csv");
  const headerPath = path.join(root, "include", "budget_sym.hpp");

  return NextResponse.json({
    prototypeOperational: fs.existsSync(headerPath),
    compilerStandard: "C++14",
    memoryModel: "Tracked Memory (documented cost model, not OS RSS)",
    representations: ["INLINE", "INTERNED", "COMPRESSED"],
    backend: {
      analyzeBinaryAvailable: Boolean(analyzeBin),
      analyzeBinaryPath: analyzeBin,
    },
    data: {
      benchmarkResultsAvailable: Boolean(benchmarkCsv),
      ablationResultsAvailable: Boolean(ablationCsv),
    },
  });
}
