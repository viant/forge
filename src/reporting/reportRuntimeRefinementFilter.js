function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRequestRefinements(request = {}) {
  const semanticRefinements = Array.isArray(request?.semanticSelection?.refinements)
    ? request.semanticSelection.refinements
    : [];
  const directRefinements = Array.isArray(request?.refinements) ? request.refinements : [];
  return (directRefinements.length > 0 ? directRefinements : semanticRefinements)
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
}

function matchesRefinementValue(row = {}, refinement = {}) {
  const field = normalizeString(refinement?.field);
  if (!field) {
    return true;
  }
  const rowValue = row?.[field];
  const values = Array.isArray(refinement?.values) ? refinement.values : [];
  if (values.length === 0) {
    return true;
  }
  return values.some((value) => normalizeString(value) === normalizeString(rowValue));
}

export function applyReportRuntimeRequestRefinements(rows = [], request = {}) {
  const refinements = normalizeRequestRefinements(request);
  if (refinements.length === 0) {
    return Array.isArray(rows) ? rows.map((row) => cloneValue(row)) : [];
  }
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => refinements.every((refinement) => {
      const op = normalizeString(refinement?.op).toLowerCase();
      if (op === "keep" || op === "drill") {
        return matchesRefinementValue(row, refinement);
      }
      if (op === "exclude") {
        return !matchesRefinementValue(row, refinement);
      }
      return true;
    }))
    .map((row) => cloneValue(row));
}
