// Pure helpers for the size charts admin API (no DB / server-only imports;
// unit-tested in src/__tests__/size-chart-helpers.test.js).

// Mongo filter for a list view. Legacy charts may have no isDeleted field.
export function sizeChartViewQuery(view) {
  return view === "trash" ? { isDeleted: true } : { isDeleted: { $ne: true } };
}

// Labels tried in order for a copy: "X (Copy)", "X (Copy 2)", "X (Copy 3)", ...
// Copying a copy keeps one suffix: "X (Copy)" -> "X (Copy 2)".
export function copyLabelCandidates(label, max = 50) {
  const base = String(label || "Size chart").trim().replace(/\s*\(Copy(?: \d+)?\)$/i, "") || "Size chart";
  const list = [`${base} (Copy)`];
  for (let i = 2; i <= max; i += 1) list.push(`${base} (Copy ${i})`);
  return list;
}

// First candidate not in `taken` (case-insensitive). `taken` covers live AND
// trashed charts because the label index is unique across both.
export function pickCopyLabel(label, taken = []) {
  const used = new Set(taken.map((t) => String(t).toLowerCase()));
  return copyLabelCandidates(label).find((c) => !used.has(c.toLowerCase())) || null;
}

// Fields of a new chart created by "Duplicate": same content, saved as a Draft,
// not assigned anywhere (a chart can only be assigned to one target).
export function buildSizeChartCopy(chart = {}, label) {
  return {
    label,
    publicHeading: chart.publicHeading || chart.label || "Size guide",
    description: chart.description || "",
    columns: Array.isArray(chart.columns) ? [...chart.columns] : [],
    rows: Array.isArray(chart.rows) ? chart.rows.map((r) => (Array.isArray(r) ? [...r] : [])) : [],
    status: "Draft",
    assignmentType: "none",
    assignmentTargetId: null,
  };
}

// Whitelist for create/update payloads so clients cannot write trash bookkeeping.
const EDITABLE = ["label", "publicHeading", "description", "columns", "rows", "assignmentType", "assignmentTargetId", "status"];
export function pickEditableSizeChartFields(data = {}) {
  const out = {};
  for (const key of EDITABLE) if (data[key] !== undefined) out[key] = data[key];
  return out;
}
