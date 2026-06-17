function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizePositiveInteger(value, fallback = 0) {
  const normalized = Math.trunc(Number(value || 0) || 0);
  return normalized > 0 ? normalized : fallback;
}

function normalizeListCursor(value = "") {
  return normalizeString(value);
}

function normalizeListLimit(value, {
  defaultLimit = 50,
  maxLimit = 200,
} = {}) {
  const normalized = normalizePositiveInteger(value, defaultLimit);
  return Math.min(normalized, maxLimit);
}

function normalizeCompileDiagnostics(diagnostics = []) {
  return (Array.isArray(diagnostics) ? diagnostics : [])
    .filter((diagnostic) => diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic))
    .map((diagnostic) => {
      const code = normalizeString(diagnostic?.code);
      const severity = normalizeString(diagnostic?.severity).toLowerCase() || "error";
      const message = normalizeString(diagnostic?.message);
      if (!code || !message) {
        return null;
      }
      return {
        code,
        severity,
        ...(normalizeString(diagnostic?.path) ? { path: normalizeString(diagnostic.path) } : {}),
        message,
        ...(normalizeString(diagnostic?.suggestedFix) ? { suggestedFix: normalizeString(diagnostic.suggestedFix) } : {}),
        ...(normalizeString(diagnostic?.blockId) ? { blockId: normalizeString(diagnostic.blockId) } : {}),
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentRef(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const reportId = normalizeString(
    value?.reportId
    || value?.id
    || value?.documentId
    || value?.reportDocumentId,
  );
  if (!reportId) {
    return null;
  }
  return {
    reportId,
  };
}

export function buildReportDocumentCompileState(reportSpec = null, {
  diagnostics = [],
} = {}) {
  if (
    !reportSpec
    || typeof reportSpec !== "object"
    || Array.isArray(reportSpec)
    || normalizeString(reportSpec?.kind) !== "reportSpec"
    || !Array.isArray(reportSpec?.blocks)
    || !Array.isArray(reportSpec?.datasets)
  ) {
    return null;
  }
  const normalizedDiagnostics = normalizeCompileDiagnostics(diagnostics);
  const hasErrors = normalizedDiagnostics.some((diagnostic) => normalizeString(diagnostic?.severity).toLowerCase() === "error");
  return {
    status: hasErrors ? "invalid" : "clean",
    reportSpecVersion: normalizePositiveInteger(reportSpec?.version, 0),
    blockCount: Array.isArray(reportSpec?.blocks) ? reportSpec.blocks.length : 0,
    datasetCount: Array.isArray(reportSpec?.datasets) ? reportSpec.datasets.length : 0,
    ...(normalizedDiagnostics.length > 0 ? { diagnostics: normalizedDiagnostics } : {}),
  };
}

export function buildCreateReportDocumentPayload({
  document = null,
  reportSpec = null,
  compileDiagnostics = [],
  source = null,
  createdAt = Date.now(),
} = {}) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }
  const reportRef = buildReportDocumentRef(document);
  const compileState = buildReportDocumentCompileState(reportSpec, {
    diagnostics: compileDiagnostics,
  });
  if (!reportRef || !compileState) {
    return null;
  }
  const title = normalizeString(document?.title) || reportRef.reportId || "Report";
  return {
    version: 1,
    kind: "createReportDocumentPayload",
    createdAt: normalizeTimestamp(createdAt),
    reportRef,
    title,
    document: cloneValue(document),
    compileState,
    ...(source && typeof source === "object" && !Array.isArray(source) ? { source: cloneValue(source) } : {}),
  };
}

export function buildUpdateReportDocumentPayload({
  reportRef = null,
  document = null,
  reportSpec = null,
  compileDiagnostics = [],
  expectedVersion = 0,
  source = null,
  updatedAt = Date.now(),
} = {}) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return null;
  }
  const documentRef = buildReportDocumentRef(document);
  const explicitReportRef = buildReportDocumentRef(reportRef);
  const normalizedReportRef = explicitReportRef || documentRef;
  const compileState = buildReportDocumentCompileState(reportSpec, {
    diagnostics: compileDiagnostics,
  });
  const normalizedExpectedVersion = normalizePositiveInteger(expectedVersion);
  if (
    !documentRef
    || !normalizedReportRef
    || !compileState
    || normalizedExpectedVersion < 1
    || (explicitReportRef && explicitReportRef.reportId !== documentRef.reportId)
  ) {
    return null;
  }
  const title = normalizeString(document?.title) || normalizedReportRef.reportId || "Report";
  return {
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: normalizeTimestamp(updatedAt),
    reportRef: normalizedReportRef,
    expectedVersion: normalizedExpectedVersion,
    title,
    document: cloneValue(document),
    compileState,
    ...(source && typeof source === "object" && !Array.isArray(source) ? { source: cloneValue(source) } : {}),
  };
}

export function buildUpdateReportDocumentConflictDiagnostic({
  updatePayload = null,
  currentVersion = 0,
  detectedAt = Date.now(),
} = {}) {
  if (!updatePayload || typeof updatePayload !== "object" || Array.isArray(updatePayload)) {
    return null;
  }
  const reportRef = buildReportDocumentRef(updatePayload?.reportRef);
  const expectedVersion = normalizePositiveInteger(updatePayload?.expectedVersion);
  const normalizedCurrentVersion = normalizePositiveInteger(currentVersion);
  if (
    normalizeString(updatePayload?.kind) !== "updateReportDocumentPayload"
    || !reportRef
    || expectedVersion < 1
    || normalizedCurrentVersion < 1
    || normalizedCurrentVersion === expectedVersion
  ) {
    return null;
  }
  const title = normalizeString(updatePayload?.title) || reportRef.reportId || "Report";
  const subtitle = normalizeString(updatePayload?.document?.subtitle);
  const description = normalizeString(updatePayload?.document?.description);
  return {
    version: 1,
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    detectedAt: normalizeTimestamp(detectedAt),
    reportRef,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(description ? { description } : {}),
    expectedVersion,
    currentVersion: normalizedCurrentVersion,
    message: `Could not update ${title} because expected version ${expectedVersion} does not match current saved version ${normalizedCurrentVersion}.`,
    suggestedAction: "Reload the latest ReportDocument before retrying the update.",
    ...(updatePayload?.source && typeof updatePayload.source === "object" && !Array.isArray(updatePayload.source)
      ? { source: cloneValue(updatePayload.source) }
      : {}),
  };
}

export function buildGetReportDocumentRequest(reportRef = null) {
  const normalizedReportRef = buildReportDocumentRef(reportRef);
  if (!normalizedReportRef) {
    return null;
  }
  return {
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: normalizedReportRef,
  };
}

export function buildGetReportDocumentResponse({
  reportRef = null,
  version = 0,
  document = null,
  savedAt = Date.now(),
  compileState = null,
  source = null,
} = {}) {
  const normalizedReportRef = buildReportDocumentRef(reportRef || document);
  const normalizedVersion = normalizePositiveInteger(version);
  if (
    !normalizedReportRef
    || normalizedVersion < 1
    || !document
    || typeof document !== "object"
    || Array.isArray(document)
  ) {
    return null;
  }
  const normalizedCompileState = compileState && typeof compileState === "object" && !Array.isArray(compileState)
    ? cloneValue(compileState)
    : null;
  return {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: normalizedReportRef,
    documentVersion: normalizedVersion,
    savedAt: normalizeTimestamp(savedAt),
    document: cloneValue(document),
    ...(normalizedCompileState ? { compileState: normalizedCompileState } : {}),
    ...(source && typeof source === "object" && !Array.isArray(source) ? { source: cloneValue(source) } : {}),
  };
}

export function buildListReportDocumentsRequest({
  scope = null,
  cursor = "",
  limit = 50,
} = {}) {
  return {
    version: 1,
    kind: "listReportDocumentsRequest",
    limit: normalizeListLimit(limit),
    ...(scope && typeof scope === "object" && !Array.isArray(scope) ? { scope: cloneValue(scope) } : {}),
    ...(normalizeListCursor(cursor) ? { cursor: normalizeListCursor(cursor) } : {}),
  };
}

export function buildListReportDocumentsResponse({
  entries = [],
  cursor = "",
  hasMore = false,
} = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const reportRef = buildReportDocumentRef(entry?.reportRef || entry?.document);
      const documentVersion = normalizePositiveInteger(entry?.documentVersion || entry?.version);
      const title = normalizeString(entry?.title || entry?.document?.title || reportRef?.reportId);
      const subtitle = normalizeString(entry?.subtitle || entry?.document?.subtitle);
      const description = normalizeString(entry?.description || entry?.document?.description);
      if (!reportRef || documentVersion < 1 || !title) {
        return null;
      }
      return {
        reportRef,
        documentVersion,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        ...(entry?.savedAt != null ? { savedAt: normalizeTimestamp(entry.savedAt) } : {}),
        ...(entry?.compileState && typeof entry.compileState === "object" && !Array.isArray(entry.compileState)
          ? { compileState: cloneValue(entry.compileState) }
          : {}),
        ...(entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source)
          ? { source: cloneValue(entry.source) }
          : {}),
      };
    })
    .filter(Boolean);
  return {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: normalizedEntries,
    cursor: normalizeListCursor(cursor),
    hasMore: hasMore === true,
  };
}

export function buildDeleteReportDocumentRequest(reportRef = null) {
  const normalizedReportRef = buildReportDocumentRef(reportRef);
  if (!normalizedReportRef) {
    return null;
  }
  return {
    version: 1,
    kind: "deleteReportDocumentRequest",
    reportRef: normalizedReportRef,
  };
}
