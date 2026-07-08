import { validateReportExportRequest } from "./schema/reportSchemas.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizePositiveInteger(value) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeEnumValue(value = "", allowed = []) {
  const normalized = normalizeString(value).toLowerCase();
  const matched = (Array.isArray(allowed) ? allowed : []).find((entry) => normalizeString(entry).toLowerCase() === normalized);
  return matched ? normalizeString(matched) : "";
}

export const REPORT_EXPORT_FORMATS = Object.freeze(["pdf", "csv", "xlsx", "html"]);
export const REPORT_EXPORT_SOURCE_KINDS = Object.freeze(["draft", "savedPayload", "savedView", "publishedSnapshot"]);

export function buildReportExportArtifactRef({
  artifactKind = "",
  artifactRef = "",
  payloadId = "",
  reportId = "",
  sourceArtifactId = "",
  containerId = "",
  stateKey = "",
} = {}) {
  const explicit = normalizeString(artifactRef);
  if (explicit) {
    return explicit;
  }
  const kind = normalizeString(artifactKind);
  const identity = normalizeString(payloadId || reportId || sourceArtifactId || containerId || stateKey);
  if (!kind || !identity) {
    return "";
  }
  return `${kind}://${identity}`;
}

export function buildReportExportSource(source = {}) {
  const from = normalizeEnumValue(source?.from, REPORT_EXPORT_SOURCE_KINDS);
  const artifactKind = normalizeString(source?.artifactKind);
  const title = normalizeString(source?.title);
  const artifactRef = buildReportExportArtifactRef({
    artifactKind,
    artifactRef: source?.artifactRef,
    payloadId: source?.payloadId,
    reportId: source?.reportId,
    sourceArtifactId: source?.sourceArtifactId,
    containerId: source?.containerId,
    stateKey: source?.stateKey,
  });
  if (!from || !artifactKind || !artifactRef || !title) {
    return null;
  }
  const next = {
    from,
    artifactKind,
    artifactRef,
    title,
  };
  const reportId = normalizeString(source?.reportId);
  const payloadId = normalizeString(source?.payloadId);
  const sourceArtifactId = normalizeString(source?.sourceArtifactId);
  const documentVersion = normalizePositiveInteger(source?.documentVersion);
  if (reportId) {
    next.reportId = reportId;
  }
  if (payloadId) {
    next.payloadId = payloadId;
  }
  if (sourceArtifactId) {
    next.sourceArtifactId = sourceArtifactId;
  }
  if (documentVersion != null) {
    next.documentVersion = documentVersion;
  }
  return next;
}

export function buildReportExportRequest({
  format = "pdf",
  source = null,
  reportSpec = null,
  reportFill = null,
  reportPrint = null,
  metadata = null,
} = {}) {
  const normalizedFormat = normalizeEnumValue(format, REPORT_EXPORT_FORMATS);
  const normalizedSource = buildReportExportSource(source || {});
  if (!normalizedFormat || !normalizedSource || !reportSpec || !reportFill) {
    return null;
  }
  const next = {
    version: 1,
    kind: "reportExportRequest",
    target: {
      format: normalizedFormat,
    },
    source: cloneValue(normalizedSource),
    reportSpec: cloneValue(reportSpec),
    reportFill: cloneValue(reportFill),
    ...(reportPrint && typeof reportPrint === "object" && !Array.isArray(reportPrint)
      ? { reportPrint: cloneValue(reportPrint) }
      : {}),
    ...(metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { metadata: cloneValue(metadata) }
      : {}),
  };
  const validation = validateReportExportRequest(next);
  if (validation.valid) {
    return next;
  }
  return null;
}

export function buildDraftReportExportRequest({
  reportDocument = null,
  reportSpec = null,
  reportFill = null,
  reportPrint = null,
  format = "pdf",
  metadata = null,
} = {}) {
  const source = reportSpec?.source && typeof reportSpec.source === "object" && !Array.isArray(reportSpec.source)
    ? reportSpec.source
    : {};
  return buildReportExportRequest({
    format,
    source: {
      from: "draft",
      artifactKind: normalizeString(source?.kind || "dashboard.reportBuilder") || "dashboard.reportBuilder",
      artifactRef: buildReportExportArtifactRef({
        artifactKind: normalizeString(source?.kind || "dashboard.reportBuilder") || "dashboard.reportBuilder",
        containerId: normalizeString(source?.containerId),
        stateKey: normalizeString(source?.stateKey),
      }),
      containerId: normalizeString(source?.containerId),
      stateKey: normalizeString(source?.stateKey),
      reportId: normalizeString(reportDocument?.id),
      title: normalizeString(reportDocument?.title || reportSpec?.title || "Report") || "Report",
    },
    reportSpec,
    reportFill,
    reportPrint,
    metadata,
  });
}

export function buildSavedReportExportRequest({
  savedReportPayload = null,
  reportFill = null,
  reportPrint = null,
  documentVersion = 0,
  format = "pdf",
  metadata = null,
} = {}) {
  const payload = savedReportPayload && typeof savedReportPayload === "object" && !Array.isArray(savedReportPayload)
    ? savedReportPayload
    : null;
  if (!payload) {
    return null;
  }
  const reportDocument = payload?.reportDocument && typeof payload.reportDocument === "object" && !Array.isArray(payload.reportDocument)
    ? payload.reportDocument
    : null;
  const payloadId = normalizeString(payload?.payloadId);
  if (!payloadId) {
    return null;
  }
  return buildReportExportRequest({
    format,
    source: {
      from: "savedPayload",
      artifactKind: normalizeString(payload?.kind || "reportBuilder.savedReportPayload") || "reportBuilder.savedReportPayload",
      payloadId,
      sourceArtifactId: normalizeString(payload?.sourceArtifactId),
      reportId: normalizeString(reportDocument?.id),
      documentVersion,
      title: normalizeString(payload?.title || reportDocument?.title || payload?.reportSpec?.title || "Report") || "Report",
    },
    reportSpec: payload?.reportSpec,
    reportFill,
    reportPrint,
    metadata,
  });
}

export function buildSavedViewReportExportRequest({
  savedView = null,
  reportSpec = null,
  reportFill = null,
  reportPrint = null,
  documentVersion = 0,
  format = "pdf",
  metadata = null,
} = {}) {
  const payload = savedView && typeof savedView === "object" && !Array.isArray(savedView)
    ? savedView
    : null;
  if (!payload) {
    return null;
  }
  const artifactId = normalizeString(payload?.viewId || payload?.savedViewId || payload?.id);
  if (!artifactId) {
    return null;
  }
  return buildReportExportRequest({
    format,
    source: {
      from: "savedView",
      artifactKind: normalizeString(payload?.kind || "reportBuilder.savedView") || "reportBuilder.savedView",
      artifactRef: buildReportExportArtifactRef({
        artifactKind: normalizeString(payload?.kind || "reportBuilder.savedView") || "reportBuilder.savedView",
        sourceArtifactId: artifactId,
      }),
      sourceArtifactId: artifactId,
      reportId: normalizeString(payload?.reportId || payload?.reportRef?.reportId),
      documentVersion,
      title: normalizeString(payload?.title || reportSpec?.title || "Report") || "Report",
    },
    reportSpec,
    reportFill,
    reportPrint,
    metadata,
  });
}

export function buildPublishedSnapshotReportExportRequest({
  publishedSnapshot = null,
  reportSpec = null,
  reportFill = null,
  reportPrint = null,
  documentVersion = 0,
  format = "pdf",
  metadata = null,
} = {}) {
  const payload = publishedSnapshot && typeof publishedSnapshot === "object" && !Array.isArray(publishedSnapshot)
    ? publishedSnapshot
    : null;
  if (!payload) {
    return null;
  }
  const artifactId = normalizeString(payload?.snapshotId || payload?.publishedSnapshotId || payload?.id);
  if (!artifactId) {
    return null;
  }
  return buildReportExportRequest({
    format,
    source: {
      from: "publishedSnapshot",
      artifactKind: normalizeString(payload?.kind || "reportBuilder.publishedSnapshot") || "reportBuilder.publishedSnapshot",
      artifactRef: buildReportExportArtifactRef({
        artifactKind: normalizeString(payload?.kind || "reportBuilder.publishedSnapshot") || "reportBuilder.publishedSnapshot",
        sourceArtifactId: artifactId,
      }),
      sourceArtifactId: artifactId,
      reportId: normalizeString(payload?.reportId || payload?.reportRef?.reportId),
      documentVersion,
      title: normalizeString(payload?.title || reportSpec?.title || "Report") || "Report",
    },
    reportSpec,
    reportFill,
    reportPrint,
    metadata,
  });
}
