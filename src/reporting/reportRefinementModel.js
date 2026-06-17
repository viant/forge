function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const SUPPORTED_REFINEMENT_OPS = new Set(["keep", "exclude", "drill", "detail"]);

function resolveDefaultRefinementId({ op = "", field = "", sourceBlockId = "" } = {}) {
  return [
    normalizeString(op),
    normalizeString(field),
    normalizeString(sourceBlockId),
  ].filter(Boolean).join(":");
}

export function normalizeReportRefinement(refinement = {}) {
  if (!refinement || typeof refinement !== "object" || Array.isArray(refinement)) {
    return null;
  }
  const op = normalizeString(refinement.op).toLowerCase();
  if (!SUPPORTED_REFINEMENT_OPS.has(op)) {
    return null;
  }
  const field = normalizeString(refinement.field);
  if (!field) {
    return null;
  }
  const sourceBlockId = normalizeString(refinement.sourceBlockId);
  const id = normalizeString(refinement.id || resolveDefaultRefinementId({ op, field, sourceBlockId }));
  if (!id) {
    return null;
  }
  return {
    id,
    op,
    field,
    values: Array.isArray(refinement.values) ? refinement.values.map((value) => cloneValue(value)) : [],
    ...(sourceBlockId ? { sourceBlockId } : {}),
    ...(normalizeString(refinement.label) ? { label: normalizeString(refinement.label) } : {}),
    ...(normalizeString(refinement.targetRef) ? { targetRef: normalizeString(refinement.targetRef) } : {}),
  };
}

export function normalizeReportRefinements(refinements = []) {
  const normalized = (Array.isArray(refinements) ? refinements : [refinements])
    .map((entry) => normalizeReportRefinement(entry))
    .filter(Boolean);
  const next = [];
  const seen = new Set();
  normalized.forEach((entry) => {
    if (seen.has(entry.id)) {
      return;
    }
    seen.add(entry.id);
    next.push(entry);
  });
  return next;
}
