import { normalizeReportRefinement, normalizeReportRefinements } from "../../reporting/reportRefinementModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveRefinementIdentity(refinement = {}) {
  return [
    normalizeString(refinement?.op).toLowerCase(),
    normalizeString(refinement?.field),
    normalizeString(refinement?.sourceBlockId),
    normalizeString(refinement?.targetRef),
  ].filter(Boolean).join(":");
}

export function buildReportRuntimeRefinement({
  op = "",
  field = "",
  value,
  values,
  sourceBlockId = "",
  label = "",
  targetRef = "",
} = {}) {
  const normalizedValues = Array.isArray(values)
    ? values.map((entry) => cloneValue(entry))
    : (value !== undefined ? [cloneValue(value)] : []);
  return normalizeReportRefinement({
    op,
    field,
    values: normalizedValues,
    sourceBlockId,
    ...(normalizeString(label) ? { label: normalizeString(label) } : {}),
    ...(normalizeString(targetRef) ? { targetRef: normalizeString(targetRef) } : {}),
  });
}

function normalizeRuntimeRefinementInput(refinement = null) {
  if (refinement && typeof refinement === "object" && !Array.isArray(refinement)
    && !Array.isArray(refinement?.values) && Object.prototype.hasOwnProperty.call(refinement, "value")) {
    return buildReportRuntimeRefinement(refinement);
  }
  return normalizeReportRefinement(refinement);
}

export function upsertReportRuntimeRefinement(refinements = [], refinement = null) {
  const normalizedRefinement = normalizeRuntimeRefinementInput(refinement);
  if (!normalizedRefinement) {
    return normalizeReportRefinements(refinements);
  }
  const targetIdentity = resolveRefinementIdentity(normalizedRefinement);
  const remaining = normalizeReportRefinements(refinements).filter((entry) => (
    resolveRefinementIdentity(entry) !== targetIdentity
  ));
  return normalizeReportRefinements([...remaining, normalizedRefinement]);
}

export function removeReportRuntimeRefinement(refinements = [], refinementId = "") {
  const normalizedId = normalizeString(refinementId);
  if (!normalizedId) {
    return normalizeReportRefinements(refinements);
  }
  return normalizeReportRefinements(refinements).filter((entry) => normalizeString(entry?.id) !== normalizedId);
}

export function clearReportRuntimeRefinements() {
  return [];
}
