function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeKnownSourceKind(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "mcptool") {
    return "mcp_tool";
  }
  return normalized;
}

export function normalizeReportDatasetSource(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const next = {
    ...cloneValue(value),
  };
  [
    "server",
    "service",
    "tool",
    "toolName",
    "profile",
    "contractRef",
    "uri",
    "method",
    "dataSourceRef",
  ].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      return;
    }
    const normalized = normalizeString(next[key]);
    if (!normalized) {
      delete next[key];
      return;
    }
    next[key] = normalized;
  });
  if (Object.prototype.hasOwnProperty.call(next, "kind")) {
    const normalizedKind = normalizeKnownSourceKind(next.kind);
    if (normalizedKind) {
      next.kind = normalizedKind;
    } else {
      delete next.kind;
    }
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function resolveReportDatasetSourceToolName(source = null) {
  const normalizedSource = normalizeReportDatasetSource(source);
  return normalizeString(normalizedSource?.toolName || normalizedSource?.tool);
}

export function isReportDatasetMCPSource(source = null) {
  const normalizedSource = normalizeReportDatasetSource(source);
  const kind = normalizeString(normalizedSource?.kind).toLowerCase();
  if (!kind) {
    return false;
  }
  return ["mcp", "mcp_tool"].includes(kind) && !!resolveReportDatasetSourceToolName(normalizedSource);
}

export function normalizeReportDatasetCapabilities(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const next = {
    ...cloneValue(value),
  };
  [
    "fieldCatalog",
    "scopeParams",
    "semanticBinding",
    "backendRefetch",
    "export",
    "preview",
    "liveFilters",
    "drill",
    "lookupHydration",
  ].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      return;
    }
    next[key] = next[key] === true;
  });
  if (isPlainObject(next.requestModel)) {
    [
      "measuresPath",
      "dimensionsPath",
      "filtersPath",
      "orderByPath",
      "limitPath",
      "offsetPath",
    ].forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(next.requestModel, key)) {
        return;
      }
      const normalized = normalizeString(next.requestModel[key]);
      if (!normalized) {
        delete next.requestModel[key];
        return;
      }
      next.requestModel[key] = normalized;
    });
  } else if (Object.prototype.hasOwnProperty.call(next, "requestModel")) {
    delete next.requestModel;
  }
  if (!isPlainObject(next.provider) && Object.prototype.hasOwnProperty.call(next, "provider")) {
    delete next.provider;
  }
  if (!isPlainObject(next.datly) && Object.prototype.hasOwnProperty.call(next, "datly")) {
    delete next.datly;
  }
  return Object.keys(next).length > 0 ? next : null;
}
