function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeDatasetRefs(datasetRefs = []) {
  const seen = new Set();
  return (Array.isArray(datasetRefs) ? datasetRefs : [])
    .map((entry) => normalizeString(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

export function resolveImplicitSingleReportDatasetRef(datasetRefs = []) {
  const normalizedDatasetRefs = normalizeDatasetRefs(datasetRefs);
  return normalizedDatasetRefs.length === 1
    ? normalizedDatasetRefs[0]
    : "";
}

export function resolveReportDatasetRefResolution({
  preferredDatasetRef = "",
  availableDatasetRefs = [],
  fallbackDatasetRef = "primary",
} = {}) {
  const explicitDatasetRef = normalizeString(preferredDatasetRef);
  if (explicitDatasetRef) {
    return {
      datasetRef: explicitDatasetRef,
      source: "explicit",
    };
  }
  const implicitSingleDatasetRef = resolveImplicitSingleReportDatasetRef(availableDatasetRefs);
  if (implicitSingleDatasetRef) {
    return {
      datasetRef: implicitSingleDatasetRef,
      source: "singleAvailable",
    };
  }
  return {
    datasetRef: normalizeString(fallbackDatasetRef || "primary") || "primary",
    source: "fallback",
  };
}
