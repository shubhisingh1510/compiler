// Real backend endpoint: extracts a scope/declaration event stream from the
// submitted source (lib/extract.ts, a labeled heuristic -- not a C parser),
// then spawns the REAL analyze.exe binary (src/analyze_main.cpp), which runs
// the actual include/budget_sym.hpp BudgetSym class and
// include/conventional_symbol_table.hpp ConventionalSymbolTable class on
// that event stream. The JSON this returns is genuinely computed by the C++
// engine, not simulated in JavaScript -- see lib/policy.ts for the (clearly
// separate, clearly labeled) client-side instant-preview simulator.
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { extractFromSource, toProtocol } from "../../../lib/extract";
import { analyzeBinaryPath } from "../../../lib/repoPaths";

export const runtime = "nodejs";

interface AnalyzeRequestBody {
  code: string;
  budgetBytes?: number;
  config?: Partial<Record<string, number>>;
}

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return NextResponse.json({ error: "Field 'code' (string, non-empty) is required." }, { status: 400 });
  }
  if (body.code.length > 20000) {
    return NextResponse.json({ error: "Source too large for this prototype (limit 20,000 characters)." }, { status: 413 });
  }

  const binPath = analyzeBinaryPath();
  if (!binPath) {
    return NextResponse.json(
      {
        error: "backend_unavailable",
        message:
          "analyze.exe has not been built yet. Run ./build.sh (or g++ -std=c++14 -O2 src/analyze_main.cpp -o analyze.exe) from the repo root, then retry.",
      },
      { status: 503 }
    );
  }

  const extracted = extractFromSource(body.code);
  const budgetBytes = body.budgetBytes && body.budgetBytes > 0 ? body.budgetBytes : 4096;
  const protocol = toProtocol(extracted, budgetBytes, body.config);

  try {
    const result = (await runAnalyzeBinary(binPath, protocol)) as Record<string, unknown>;
    return NextResponse.json({
      ...result,
      extractionWarnings: extracted.warnings,
      declarationCount: extracted.events.filter((e) => e.kind === "insert").length,
      scopeCount: extracted.scopes.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "analyze_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function runAnalyzeBinary(binPath: string, protocolInput: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("analyze.exe timed out (>5s)."));
    }, 5000);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    proc.on("close", (codeNum) => {
      clearTimeout(timeout);
      if (codeNum !== 0) {
        reject(new Error(`analyze.exe exited with code ${codeNum}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`analyze.exe produced non-JSON output: ${stdout.slice(0, 300)}`));
      }
    });

    proc.stdin.write(protocolInput);
    proc.stdin.end();
  });
}
