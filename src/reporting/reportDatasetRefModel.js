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

// Match the backend section planner's declared-reference closure, including
// nested content, trends, centers and scope/visibility bindings. Hosts use this
// when planning lazy reads, so optional visuals cannot lose required data.
export function getReportBlockDatasetRefs(block = {}) {
  const refs = [], visited = new WeakSet();
  const collect = value => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (["datasetRef", "secondaryDatasetRef", "comparisonDatasetRef"].includes(key)) {
        refs.push(item);
      } else if (key === "datasetRefs") {
        if (Array.isArray(item)) refs.push(...item);
      } else {
        collect(item);
      }
    }
  };
  collect(block);
  return normalizeDatasetRefs(refs);
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
