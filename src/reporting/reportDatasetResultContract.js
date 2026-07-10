import { extractData, resolveKey } from "./dataEnvelopeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeReportDatasetExtractConfig(value = null) {
  if (!isPlainObject(value)) {
    return {
      selectors: {},
      paging: null,
    };
  }
  return {
    selectors: isPlainObject(value?.selectors) ? value.selectors : {},
    paging: isPlainObject(value?.paging) ? value.paging : null,
  };
}

export function buildReportDatasetExtractConfigFingerprint(extractConfig = null) {
  const normalizedExtractConfig = normalizeReportDatasetExtractConfig(extractConfig);
  return JSON.stringify({
    selectors: normalizedExtractConfig.selectors,
    paging: normalizedExtractConfig.paging,
  });
}

export function normalizeReportDatasetResultContract(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const shape = normalizeString(value?.shape || "rowSet") || "rowSet";
  const rowPath = normalizeString(value?.rowPath);
  const hasMorePath = normalizeString(value?.hasMorePath);
  if (!rowPath && !hasMorePath) {
    return null;
  }
  return {
    shape,
    ...(rowPath ? { rowPath } : {}),
    ...(hasMorePath ? { hasMorePath } : {}),
  };
}

function coerceRows(value, shape = "rowSet") {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  if (shape.toLowerCase() === "singlerow") {
    return [value];
  }
  return isPlainObject(value) ? [value] : [];
}

function resolveRowsFromResultContract(body = null, resultContract = null) {
  const normalizedContract = normalizeReportDatasetResultContract(resultContract);
  if (!normalizedContract?.rowPath) {
    return null;
  }
  const rawRows = normalizedContract.rowPath === "."
    ? body
    : resolveKey(body, normalizedContract.rowPath);
  if (typeof rawRows === "undefined") {
    return null;
  }
  return coerceRows(rawRows, normalizedContract.shape);
}

function resolveHasMoreFromResultContract(body = null, resultContract = null) {
  const normalizedContract = normalizeReportDatasetResultContract(resultContract);
  if (!normalizedContract?.hasMorePath) {
    return null;
  }
  const rawValue = normalizedContract.hasMorePath === "."
    ? body
    : resolveKey(body, normalizedContract.hasMorePath);
  if (typeof rawValue === "undefined") {
    return null;
  }
  return rawValue === true;
}

export function buildReportDatasetResultContractFingerprint(resultContract = null) {
  const normalizedContract = normalizeReportDatasetResultContract(resultContract);
  return normalizedContract ? JSON.stringify(normalizedContract) : "";
}

export function resolveReportDatasetFetchResult({
  body = null,
  extractConfig = null,
  resultContract = null,
} = {}) {
  const normalizedExtractConfig = normalizeReportDatasetExtractConfig(extractConfig);
  const contractRows = resolveRowsFromResultContract(body, resultContract);
  const extracted = contractRows === null
    ? extractData(
      normalizedExtractConfig.selectors,
      normalizedExtractConfig.paging,
      body,
    )
    : { records: contractRows };
  const contractHasMore = resolveHasMoreFromResultContract(body, resultContract);
  const hasMore = contractHasMore == null
    ? (body?.hasMore === true)
    : contractHasMore;
  return {
    rows: Array.isArray(extracted?.records) ? extracted.records : [],
    hasMore,
  };
}
