// Lightweight declaration + scope extractor.
//
// IMPORTANT, stated plainly for anyone reading this (and shown in the UI):
// this is NOT a C/C++ parser. It is a small heuristic tokenizer that
// recognizes the common "TYPE NAME" declaration shape and brace-delimited
// scopes well enough to demonstrate BUDGET-SYM on realistic-looking snippets.
// It will misparse arbitrary real-world C++ (templates, complex expressions,
// multi-declarator lines like `int a, b;` only catches `a`, etc.). Its job is
// only to turn source text into the {scope, declaration} event stream that
// analyze.exe (the REAL BudgetSym C++ engine) then actually executes -- see
// docs/methodology.md's honesty rule and src/analyze_main.cpp's header
// comment.
export interface ExtractedEvent {
  kind: "enter" | "exit" | "insert";
  name?: string;
  typeHint?: string;
}

export interface ExtractedScope {
  id: number;
  parentId: number;
  label: string;
}

export interface ExtractResult {
  scopes: ExtractedScope[];
  events: ExtractedEvent[];
  warnings: string[];
}

const KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "return", "break", "continue",
  "switch", "case", "default", "sizeof", "typedef", "struct", "class",
  "enum", "union", "namespace", "using", "public", "private", "protected",
  "static", "const", "volatile", "extern", "inline", "virtual", "override",
  "new", "delete", "template", "typename", "true", "false", "nullptr",
  "void", "goto", "asm",
]);

const TYPE_KEYWORDS = new Set([
  "int", "float", "double", "char", "bool", "long", "short", "unsigned",
  "signed", "size_t", "uint8_t", "uint16_t", "uint32_t", "uint64_t",
  "int8_t", "int16_t", "int32_t", "int64_t", "auto", "void",
]);

function stripComments(src: string): string {
  // Replace comment contents with spaces (preserves line/column layout,
  // which we don't strictly need here, but avoids ever tokenizing inside one).
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") { out += " "; i++; }
    } else if (src[i] === "/" && src[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

type Tok = { text: string; isIdent: boolean };

function tokenize(src: string): Tok[] {
  const tokens: Tok[] = [];
  const re = /[A-Za-z_]\w*|[{}();,=\[\]]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const text = m[0];
    tokens.push({ text, isIdent: /^[A-Za-z_]/.test(text) });
  }
  return tokens;
}

export function extractFromSource(source: string): ExtractResult {
  const warnings: string[] = [];
  const clean = stripComments(source);
  const tokens = tokenize(clean);

  const scopes: ExtractedScope[] = [{ id: 0, parentId: -1, label: "global" }];
  const events: ExtractedEvent[] = [];
  let nextScopeId = 1;
  const scopeStack = [0];

  // Buffered declarations found inside a `(...)` parameter list, flushed
  // into the function's scope once we confirm it actually opens (a `{`
  // follows the closing paren) -- discarded otherwise (prototype / call).
  let inParams = false;
  let parenDepth = 0;
  let pendingLabel: string | null = null;
  let paramBuffer: { name: string; typeHint: string }[] = [];

  let lastIdent: string | null = null; // most recent identifier token, for the "TYPE NAME" pair heuristic
  let sawDeclThisStatement = false;

  const resetPair = () => { lastIdent = null; };

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    const next = tokens[idx + 1];

    if (!tok.isIdent) {
      switch (tok.text) {
        case "(": {
          // A "(" immediately after an identifier pair (TYPE NAME) marks a
          // function signature -- e.g. `void calculate(`. Start buffering
          // parameter declarations; the function's own scope opens later at
          // the matching `{`.
          if (lastIdent) {
            pendingLabel = lastIdent;
            inParams = true;
            parenDepth = 1;
            paramBuffer = [];
          } else if (inParams) {
            parenDepth++;
          }
          resetPair();
          break;
        }
        case ")": {
          if (inParams) {
            parenDepth--;
            if (parenDepth <= 0) {
              inParams = false;
              // Leave pendingLabel/paramBuffer set; resolved when we see the next `{` (or discarded at `;`).
            }
          }
          resetPair();
          break;
        }
        case "{": {
          const parent = scopeStack[scopeStack.length - 1];
          const label = pendingLabel ? `function:${pendingLabel}` : "block";
          const id = nextScopeId++;
          scopes.push({ id, parentId: parent, label });
          scopeStack.push(id);
          events.push({ kind: "enter" });
          if (pendingLabel) {
            for (const p of paramBuffer) {
              events.push({ kind: "insert", name: p.name, typeHint: p.typeHint });
            }
          }
          pendingLabel = null;
          paramBuffer = [];
          resetPair();
          sawDeclThisStatement = false;
          break;
        }
        case "}": {
          if (scopeStack.length > 1) {
            scopeStack.pop();
            events.push({ kind: "exit" });
          } else {
            warnings.push("Unbalanced '}' ignored (more closing braces than opening ones).");
          }
          resetPair();
          break;
        }
        case ";": {
          // Statement boundary: a pending function signature followed by ';'
          // is a prototype (no body) -- discard buffered params, no scope opens.
          pendingLabel = null;
          paramBuffer = [];
          resetPair();
          sawDeclThisStatement = false;
          break;
        }
        case ",": {
          // Keep pair-matching reset so `int a, b;` only ever catches `a`
          // (documented limitation -- see file header comment).
          resetPair();
          break;
        }
        case "=":
        case "[":
        case "]":
          resetPair();
          break;
      }
      continue;
    }

    // Identifier token.
    if (KEYWORDS.has(tok.text)) { resetPair(); continue; }

    if (lastIdent && !sawDeclThisStatement) {
      // We have TYPE=lastIdent, NAME=tok.text. Only accept if what follows
      // isn't '(' (that would make `tok.text` a function name, handled above
      // when the '(' token itself is processed) and isn't another identifier
      // stacked directly on top (e.g. "unsigned int x" -- keep the closer one
      // as the type by shifting the window forward instead of double-firing).
      const followedByCall = next && !next.isIdent && next.text === "(";
      if (!followedByCall) {
        const typeHint = TYPE_KEYWORDS.has(lastIdent) ? lastIdent : lastIdent;
        if (inParams) {
          paramBuffer.push({ name: tok.text, typeHint });
        } else {
          events.push({ kind: "insert", name: tok.text, typeHint });
        }
        sawDeclThisStatement = true;
      }
    }
    lastIdent = tok.text;
  }

  if (scopeStack.length > 1) {
    warnings.push(`${scopeStack.length - 1} scope(s) never closed (missing '}') -- auto-closed at end of input.`);
    while (scopeStack.length > 1) {
      scopeStack.pop();
      events.push({ kind: "exit" });
    }
  }

  return { scopes, events, warnings };
}

function sanitizeToken(s: string): string {
  // Protocol lines are whitespace-delimited; identifiers/labels are already
  // constrained to \w+ by the tokenizer/regex above, but scope labels prefix
  // with "function:<name>" which is still whitespace-free, so this is a
  // defensive no-op in practice, not a real sanitizer.
  return s.replace(/\s+/g, "_");
}

export function toProtocol(
  extracted: ExtractResult,
  budgetBytes: number,
  cfgOverrides?: Partial<Record<string, number>>
): string {
  const lines: string[] = [];
  lines.push(`BUDGET ${Math.max(1, Math.floor(budgetBytes))}`);
  if (cfgOverrides) {
    for (const [k, v] of Object.entries(cfgOverrides)) {
      if (typeof v === "number" && !Number.isNaN(v)) lines.push(`CFG ${k} ${v}`);
    }
  }
  for (const s of extracted.scopes) {
    lines.push(`SCOPE ${s.id} ${s.parentId} ${sanitizeToken(s.label)}`);
  }
  for (const e of extracted.events) {
    if (e.kind === "enter") lines.push("EVENT ENTER");
    else if (e.kind === "exit") lines.push("EVENT EXIT");
    else lines.push(`EVENT INSERT ${sanitizeToken(e.name || "")} ${sanitizeToken(e.typeHint || "unknown")}`);
  }
  lines.push("END");
  return lines.join("\n");
}
