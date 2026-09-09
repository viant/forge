function normalizeString(value) {
  return String(value ?? "").trim();
}

export function resolveReportBuilderDefinitionDataSourceRef(container = {}, config = {}) {
  return normalizeString(
    config?.definitionDataSourceRef
    || config?.runtime?.definitionDataSourceRef
    || container?.definitionDataSourceRef
    || container?.dashboard?.reportBuilder?.definitionDataSourceRef,
  );
}

export function resolveReportBuilderDefinitionInitialization({
  dataSourceRef = "",
  contextAvailable = false,
  fetchRequested = false,
  refreshRequested = false,
  loading = false,
  error = null,
  rowCount = 0,
  definitionReady = false,
  definitionError = "",
} = {}) {
  const ref = normalizeString(dataSourceRef);
  if (!ref) {
    return { enabled: false, ready: true, status: "disabled", shouldFetch: false, message: "" };
  }
  if (!contextAvailable) {
    return { enabled: true, ready: false, status: "error", shouldFetch: false, message: "Report definition datasource is unavailable." };
  }
  if (normalizeString(definitionError)) {
    return { enabled: true, ready: false, status: "error", shouldFetch: false, message: normalizeString(definitionError) };
  }
  if (error) {
    return { enabled: true, ready: false, status: "error", shouldFetch: false, message: "Report definition could not be loaded." };
  }
  if (definitionReady) {
    return { enabled: true, ready: true, status: "ready", shouldFetch: false, message: "" };
  }
  if (loading) {
    return { enabled: true, ready: false, status: "loading", shouldFetch: false, message: "Loading report definition…" };
  }
  if (Number(rowCount || 0) > 0) {
    return { enabled: true, ready: false, status: "error", shouldFetch: false, message: "Report definition identity could not be verified." };
  }
  if (fetchRequested || refreshRequested) {
    return { enabled: true, ready: false, status: "error", shouldFetch: false, message: "No authorized report definition was returned." };
  }
  return { enabled: true, ready: false, status: "loading", shouldFetch: true, message: "Loading report definition…" };
}
