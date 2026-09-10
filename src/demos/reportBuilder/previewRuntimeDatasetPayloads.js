function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeError(error = null, datasetId = "") {
  if (error == null || error === false || error === "") {
    return null;
  }
  const message = normalizeString(error?.message || error) || `Runtime dataset '${datasetId}' failed.`;
  const diagnostics = Array.isArray(error?.diagnostics)
    ? cloneValue(error.diagnostics)
    : [{
      code: "runtimePreviewDatasetSeedError",
      severity: "error",
      message,
    }];
  return { message, diagnostics };
}

export function normalizePreviewRuntimeDatasetPayloads(payloads = {}) {
  if (!payloads || typeof payloads !== "object" || Array.isArray(payloads)) {
    return {};
  }
  const entries = Object.entries(payloads).flatMap(([rawDatasetId, rawPayload]) => {
    const datasetId = normalizeString(rawDatasetId);
    if (!datasetId || !rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
      return [];
    }
    const error = normalizeError(rawPayload.error, datasetId);
    const diagnostics = [
      ...(Array.isArray(rawPayload.diagnostics) ? cloneValue(rawPayload.diagnostics) : []),
      ...(error?.diagnostics || []),
    ].filter((diagnostic, index, all) => (
      index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(diagnostic))
    ));
    return [[datasetId, {
      rows: Array.isArray(rawPayload.rows) ? cloneValue(rawPayload.rows) : [],
      hasMore: rawPayload.hasMore === true,
      diagnostics,
      ...(error ? { error } : {}),
    }]];
  });
  return Object.fromEntries(entries);
}

export function mergePreviewRuntimeDatasetPayloads(fetchedPayloads = {}, seededPayloads = {}) {
  return {
    ...normalizePreviewRuntimeDatasetPayloads(fetchedPayloads),
    ...normalizePreviewRuntimeDatasetPayloads(seededPayloads),
  };
}

export function resolvePreviewRuntimeDatasetInputs({
  rows = [],
  hasMore = false,
  error = null,
  fetchedPayloads = {},
  seededPayloads = {},
  primaryDatasetId = "primary",
} = {}) {
  const payloads = mergePreviewRuntimeDatasetPayloads(fetchedPayloads, seededPayloads);
  const normalizedPrimaryDatasetId = normalizeString(primaryDatasetId) || "primary";
  const primaryPayload = payloads[normalizedPrimaryDatasetId] || null;
  const namedPayloads = { ...payloads };
  delete namedPayloads[normalizedPrimaryDatasetId];
  return {
    rows: primaryPayload ? cloneValue(primaryPayload.rows) : cloneValue(Array.isArray(rows) ? rows : []),
    hasMore: primaryPayload ? primaryPayload.hasMore === true : hasMore === true,
    error: primaryPayload
      ? (primaryPayload.error || (primaryPayload.diagnostics.length > 0 ? { diagnostics: cloneValue(primaryPayload.diagnostics) } : null))
      : error,
    datasetPayloads: namedPayloads,
  };
}
