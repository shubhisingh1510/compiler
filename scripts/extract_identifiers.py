#!/usr/bin/env python3
"""Extract a plain identifier stream from a directory of C source (Review-2
Step 3: real-world corpus evaluation).

Usage:
    python scripts/extract_identifiers.py <source_dir> <output_txt_file>

Walks <source_dir> recursively for .c/.h files, tokenizes each file with a
plain identifier regex, filters out C89/C99 language keywords, and writes
one identifier per line (source order, duplicates preserved) to
<output_txt_file>. That file is then fed to corpus_bench.exe.

This script does NOT fetch any source itself -- no network calls, no git
operations. It only tokenizes files already present on disk (see
docs/corpus_setup.md for how to obtain real corpora).
"""
import os
import re
import sys

# Only true language keywords are filtered -- NOT standard-library or
# platform typedefs like uint32_t, size_t, etc. Real embedded identifier
# streams should stay mostly intact (that's what BudgetSym is meant to
# compress), and keyword-filtering is meant to remove syntax noise, not do
# a stdlib-aware cleanup pass.
C_KEYWORDS = {
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if",
    "inline", "int", "long", "register", "restrict", "return", "short",
    "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
    "unsigned", "void", "volatile", "while",
    # C99 additions
    "_Bool", "_Complex", "_Imaginary",
}

IDENTIFIER_RE = re.compile(r'\b[A-Za-z_][A-Za-z0-9_]*\b')


def find_source_files(source_dir):
    files = []
    for root, _dirs, filenames in os.walk(source_dir):
        for fn in filenames:
            if fn.endswith(".c") or fn.endswith(".h"):
                files.append(os.path.join(root, fn))
    # Sort the full path list so re-running on the same tree is reproducible
    # regardless of os.walk's directory-entry ordering.
    files.sort()
    return files


def main():
    if len(sys.argv) != 3:
        print("Usage: python scripts/extract_identifiers.py <source_dir> <output_txt_file>",
              file=sys.stderr)
        return 1

    source_dir = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.isdir(source_dir):
        print("ERROR: source dir '%s' does not exist or is not a directory" % source_dir,
              file=sys.stderr)
        return 1

    files = find_source_files(source_dir)
    raw_tokens = 0
    kept_identifiers = []

    for path in files:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
        except OSError as e:
            print("WARNING: could not read %s: %s" % (path, e), file=sys.stderr)
            continue
        tokens = IDENTIFIER_RE.findall(text)
        raw_tokens += len(tokens)
        for tok in tokens:
            if tok not in C_KEYWORDS:
                kept_identifiers.append(tok)

    with open(output_file, "w", encoding="utf-8") as out:
        for ident in kept_identifiers:
            out.write(ident + "\n")

    print("Files scanned:          %d" % len(files))
    print("Raw tokens found:       %d" % raw_tokens)
    print("Tokens after filtering: %d" % len(kept_identifiers))
    print("Lines written to %s: %d (matches filtered token count)" % (
        output_file, len(kept_identifiers)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
