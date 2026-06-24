import { buildShareableLifecycleTransition, validateShareableLifecycleTransition } from "../lifecycle/shareableLifecycleModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeTimestamp(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return Number.isFinite(Date.parse(normalized)) ? normalized : "";
}

function normalizeMetadata(value = null) {
  return isPlainObject(value) ? cloneValue(value) : {};
}

export const REPORT_AUDIT_EVENT_TYPES = Object.freeze([
  "report.share",
  "report.revoke",
  "report.publish",
  "report.archive",
  "report.export",
  "report.view.create",
]);

export function buildReportAuditEvent(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const eventType = normalizeString(value?.eventType);
  const artifactRef = normalizeString(value?.artifactRef);
  const version = normalizePositiveInteger(value?.version);
  const actorRef = normalizeString(value?.actorRef);
  const occurredAt = normalizeTimestamp(value?.occurredAt);
  const metadata = normalizeMetadata(value?.metadata);
  if (!eventType && !artifactRef && version < 1 && !actorRef && !occurredAt && Object.keys(metadata).length === 0) {
    return null;
  }
  return {
    ...(eventType ? { eventType } : {}),
    ...(artifactRef ? { artifactRef } : {}),
    ...(version > 0 ? { version } : {}),
    ...(actorRef ? { actorRef } : {}),
    ...(occurredAt ? { occurredAt } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function validateReportAuditEvent(value = null) {
  const event = buildReportAuditEvent(value);
  if (!event) {
    return {
      valid: false,
      errors: [
        {
          path: "$",
          code: "required",
          message: "Audit event payload is required.",
        },
      ],
    };
  }
  const errors = [];
  if (!event.eventType) {
    errors.push({
      path: "$.eventType",
      code: "required",
      message: "Audit events require an eventType.",
    });
  } else if (!REPORT_AUDIT_EVENT_TYPES.includes(event.eventType)) {
    errors.push({
      path: "$.eventType",
      code: "invalid",
      message: `Unsupported report audit event type '${event.eventType}'.`,
    });
  }
  if (!event.artifactRef) {
    errors.push({
      path: "$.artifactRef",
      code: "required",
      message: "Audit events require an artifactRef.",
    });
  }
  if (normalizePositiveInteger(event.version) < 1) {
    errors.push({
      path: "$.version",
      code: "required",
      message: "Audit events require a positive version.",
    });
  }
  if (!event.actorRef) {
    errors.push({
      path: "$.actorRef",
      code: "required",
      message: "Audit events require an actorRef.",
    });
  }
  if (!event.occurredAt) {
    errors.push({
      path: "$.occurredAt",
      code: "required",
      message: "Audit events require an ISO-8601 occurredAt timestamp.",
    });
  }
  if (value?.metadata !== undefined && !isPlainObject(value?.metadata)) {
    errors.push({
      path: "$.metadata",
      code: "invalid",
      message: "Audit event metadata must be an object.",
    });
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildReportAuditEventFromParts({
  eventType = "",
  artifactRef = "",
  version = 0,
  actorRef = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  const event = buildReportAuditEvent({
    eventType,
    artifactRef,
    version,
    actorRef,
    occurredAt,
    metadata,
  });
  return validateReportAuditEvent(event).valid ? event : null;
}

export function buildShareableLifecycleAuditEvent(transition = null, {
  version = 0,
  actorRef = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  const normalizedTransition = buildShareableLifecycleTransition(transition);
  if (!normalizedTransition || !validateShareableLifecycleTransition(normalizedTransition).valid) {
    return null;
  }
  const eventType = normalizedTransition.to === "published"
    ? "report.publish"
    : (normalizedTransition.to === "archived" ? "report.archive" : "");
  if (!eventType) {
    return null;
  }
  return buildReportAuditEventFromParts({
    eventType,
    artifactRef: normalizedTransition.artifactRef,
    version,
    actorRef,
    occurredAt,
    metadata: {
      from: normalizedTransition.from,
      to: normalizedTransition.to,
      ...(normalizedTransition.reason ? { reason: normalizedTransition.reason } : {}),
      ...normalizeMetadata(metadata),
    },
  });
}

export function buildReportShareAuditEvent({
  artifactRef = "",
  version = 0,
  actorRef = "",
  principalRef = "",
  role = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  return buildReportAuditEventFromParts({
    eventType: "report.share",
    artifactRef,
    version,
    actorRef,
    occurredAt,
    metadata: {
      ...(normalizeString(principalRef) ? { principalRef: normalizeString(principalRef) } : {}),
      ...(normalizeString(role) ? { role: normalizeString(role) } : {}),
      ...normalizeMetadata(metadata),
    },
  });
}

export function buildReportRevokeAuditEvent({
  artifactRef = "",
  version = 0,
  actorRef = "",
  principalRef = "",
  role = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  return buildReportAuditEventFromParts({
    eventType: "report.revoke",
    artifactRef,
    version,
    actorRef,
    occurredAt,
    metadata: {
      ...(normalizeString(principalRef) ? { principalRef: normalizeString(principalRef) } : {}),
      ...(normalizeString(role) ? { role: normalizeString(role) } : {}),
      ...normalizeMetadata(metadata),
    },
  });
}

export function buildReportExportAuditEvent(request = null, {
  version = 0,
  actorRef = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  const artifactRef = normalizeString(request?.source?.artifactRef);
  const normalizedVersion = normalizePositiveInteger(version || request?.source?.documentVersion);
  if (!artifactRef || normalizedVersion < 1) {
    return null;
  }
  return buildReportAuditEventFromParts({
    eventType: "report.export",
    artifactRef,
    version: normalizedVersion,
    actorRef,
    occurredAt,
    metadata: {
      ...(normalizeString(request?.source?.from) ? { from: normalizeString(request.source.from) } : {}),
      ...(normalizeString(request?.source?.artifactKind) ? { artifactKind: normalizeString(request.source.artifactKind) } : {}),
      ...(normalizeString(request?.target?.format) ? { format: normalizeString(request.target.format) } : {}),
      ...normalizeMetadata(metadata),
    },
  });
}

export function buildReportViewCreationAuditEvent({
  artifactRef = "",
  version = 0,
  actorRef = "",
  baseArtifactRef = "",
  publishedSnapshotArtifactRef = "",
  occurredAt = "",
  metadata = {},
} = {}) {
  return buildReportAuditEventFromParts({
    eventType: "report.view.create",
    artifactRef,
    version,
    actorRef,
    occurredAt,
    metadata: {
      ...(normalizeString(baseArtifactRef) ? { baseArtifactRef: normalizeString(baseArtifactRef) } : {}),
      ...(normalizeString(publishedSnapshotArtifactRef) ? { publishedSnapshotArtifactRef: normalizeString(publishedSnapshotArtifactRef) } : {}),
      ...normalizeMetadata(metadata),
    },
  });
}
