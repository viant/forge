function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildReportRuntimeDetailDiagnosticMessage(resolvedDetailTarget = {}) {
  const unresolved = Array.isArray(resolvedDetailTarget?.unresolvedParameters)
    ? resolvedDetailTarget.unresolvedParameters
    : [];
  if (unresolved.length === 0) {
    return null;
  }
  const labels = unresolved
    .map((entry) => normalizeString(entry?.parameter))
    .filter(Boolean);
  if (labels.length === 0) {
    return "Detail target resolved with omitted parameters.";
  }
  return `Detail target resolved with omitted parameters: ${labels.join(", ")}.`;
}
