function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeStringList(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

export function shouldKeepPrimaryDataset({
  includePrimaryBlocks = true,
  datasetBackedBlockDatasetRefs = [],
  availableNonPrimaryDatasetRefs = [],
} = {}) {
  if (includePrimaryBlocks) {
    return true;
  }
  const normalizedDatasetRefs = normalizeStringList(datasetBackedBlockDatasetRefs);
  if (normalizedDatasetRefs.length === 0) {
    return true;
  }
  const normalizedAvailableNonPrimaryRefs = new Set(
    normalizeStringList(availableNonPrimaryDatasetRefs)
      .filter((datasetRef) => datasetRef !== "primary"),
  );
  if (normalizedDatasetRefs.some((datasetRef) => datasetRef === "primary")) {
    return true;
  }
  return !normalizedDatasetRefs.some((datasetRef) => normalizedAvailableNonPrimaryRefs.has(datasetRef));
}
