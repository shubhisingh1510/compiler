// Minimal CSV parser for results/*.csv -- no quoting/escaping support since
// these files are our own generated numeric CSVs (no commas or quotes ever
// appear inside a field). Not a general-purpose CSV library by design.
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(",");
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h.trim()] = (cells[i] ?? "").trim(); });
    return row;
  });
}

export function toNumberRow<T extends Record<string, string>>(
  row: T,
  numericFields: string[]
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...row };
  for (const f of numericFields) {
    if (f in row) out[f] = Number(row[f]);
  }
  return out;
}
