import {
    buildReportExportAuditEvent,
    buildReportShareAuditEvent,
    buildReportViewCreationAuditEvent,
    buildShareableLifecycleAuditEvent,
} from "../../reporting/audit/reportAuditEventModel.js";
import { extractSavedViewOverlayArtifactState } from "../../reporting/views/savedViewOverlayModel.js";
import { resolveReportBuilderLifecycleResultEnvelope } from "./reportBuilderLifecycleResult.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
    const numeric = Math.trunc(Number(value));
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeMetadata(value = null) {
    return isPlainObject(value) ? cloneValue(value) : {};
}

function normalizeOccurredAt(value = "") {
    const normalized = normalizeString(value || new Date().toISOString());
    return Number.isFinite(Date.parse(normalized)) ? normalized : new Date().toISOString();
}

function buildArtifactRef(kind = "", artifactId = "") {
    const normalizedKind = normalizeString(kind);
    const normalizedArtifactId = normalizeString(artifactId);
    return normalizedKind && normalizedArtifactId
        ? `${normalizedKind}://${normalizedArtifactId}`
        : "";
}

function mergeMetadata(...values) {
    return values.reduce((acc, entry) => ({
        ...acc,
        ...normalizeMetadata(entry),
    }), {});
}

function resolveShareableArtifactKind(value = null) {
    return normalizeString(
        value?.shareable?.artifactKind
        || value?.artifactKind
        || value?.source?.artifactKind
        || value?.source?.kind
        || value?.kind,
    );
}

function resolveShareableArtifactId(value = null) {
    return normalizeString(
        value?.shareable?.artifactId
        || value?.payloadId
        || value?.viewId
        || value?.savedViewId
        || value?.snapshotId
        || value?.publishedSnapshotId
        || value?.id
        || value?.source?.payloadId
        || value?.source?.sourceArtifactId
        || value?.sourceArtifactId,
    );
}

function resolveShareableArtifactRef(value = null) {
    return normalizeString(
        value?.shareable?.artifactRef
        || value?.artifactRef
        || value?.source?.artifactRef,
    ) || buildArtifactRef(resolveShareableArtifactKind(value), resolveShareableArtifactId(value));
}

function resolveShareableArtifactVersion(value = null) {
    return normalizePositiveInteger(
        value?.shareable?.version
        || value?.shareableVersion
        || value?.documentVersion
        || value?.version,
    );
}

async function recordReportBuilderAuditEvent(event = null, handler = null, {
    invalidEventMessage = "",
} = {}) {
    const resolvedHandler = resolveReportBuilderAuditHandler(handler);
    if (!resolvedHandler) {
        return {
            recorded: false,
            skipped: true,
            issue: "",
            event: null,
        };
    }
    if (!event) {
        return {
            recorded: false,
            skipped: false,
            issue: normalizeString(invalidEventMessage) || "Could not prepare the requested audit event.",
            event: null,
        };
    }
    try {
        if (typeof resolvedHandler.recordEvent === "function") {
            await resolvedHandler.recordEvent(cloneValue(event));
        } else {
            await resolvedHandler.runEvent(cloneValue(event));
        }
        return {
            recorded: true,
            skipped: false,
            issue: "",
            event,
        };
    } catch (error) {
        const message = normalizeString(error?.message || error);
        return {
            recorded: false,
            skipped: false,
            issue: message ? `Audit recording failed. ${message}` : "Audit recording failed.",
            event,
        };
    }
}

export function resolveReportBuilderAuditHandler(value = null) {
    const directCandidate = isPlainObject(value) ? value : null;
    const contextCandidate = isPlainObject(value?.handlers?.reportAudit)
        ? value.handlers.reportAudit
        : null;
    const candidate = contextCandidate || directCandidate;
    const recordEvent = typeof candidate?.recordEvent === "function"
        ? candidate.recordEvent
        : null;
    const runEvent = typeof candidate?.runEvent === "function"
        ? candidate.runEvent
        : null;
    if (!recordEvent && !runEvent) {
        return null;
    }
    return {
        ...(recordEvent ? { recordEvent } : {}),
        ...(runEvent ? { runEvent } : {}),
    };
}

export function resolveReportBuilderAuditActorRef(builderContext = {}) {
    return normalizeString(builderContext?.identity?.actorRef);
}

export function resolveReportBuilderAuditMetadata({
    builderContext = {},
    container = null,
    metadata = {},
} = {}) {
    return mergeMetadata(
        {
            ...(normalizeString(builderContext?.identity?.windowId)
                ? { windowId: normalizeString(builderContext.identity.windowId) }
                : {}),
            ...(normalizeString(builderContext?.identity?.dataSourceRef || container?.dataSourceRef)
                ? { dataSourceRef: normalizeString(builderContext?.identity?.dataSourceRef || container?.dataSourceRef) }
                : {}),
            ...(normalizeString(container?.id) ? { containerId: normalizeString(container.id) } : {}),
        },
        metadata,
    );
}

export function buildReportBuilderLifecycleAuditEvent(request = null, {
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const normalizedActorRef = normalizeString(actorRef);
    if (!isPlainObject(request) || !normalizedActorRef) {
        return null;
    }
    const normalizedOccurredAt = normalizeOccurredAt(occurredAt);
    const action = normalizeString(request?.action).toLowerCase();
    const version = normalizePositiveInteger(request?.version);
    const mergedMetadata = mergeMetadata(request?.metadata, metadata);
    if (action === "share") {
        return buildReportShareAuditEvent({
            artifactRef: normalizeString(request?.artifactRef),
            version,
            actorRef: normalizedActorRef,
            occurredAt: normalizedOccurredAt,
            metadata: mergedMetadata,
        });
    }
    if (action === "publish" || action === "archive") {
        return buildShareableLifecycleAuditEvent(request?.transition, {
            version,
            actorRef: normalizedActorRef,
            occurredAt: normalizedOccurredAt,
            metadata: mergedMetadata,
        });
    }
    return null;
}

export function buildReportBuilderExportAuditEvent(request = null, {
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const normalizedActorRef = normalizeString(actorRef);
    if (!isPlainObject(request) || !normalizedActorRef) {
        return null;
    }
    return buildReportExportAuditEvent(request, {
        actorRef: normalizedActorRef,
        occurredAt: normalizeOccurredAt(occurredAt),
        metadata: mergeMetadata(metadata),
    });
}

export function buildReportBuilderViewCreationAuditEvent(result = null, request = null, {
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const normalizedActorRef = normalizeString(actorRef);
    if (!isPlainObject(result) || !isPlainObject(request) || !normalizedActorRef) {
        return null;
    }
    const createdArtifact = resolveReportBuilderLifecycleResultEnvelope(result)?.sharedArtifact || result;
    const createdKind = resolveShareableArtifactKind(createdArtifact);
    if (createdKind !== "reportBuilder.savedView" && createdKind !== "reportBuilder.publishedSnapshot") {
        return null;
    }
    const artifactRef = resolveShareableArtifactRef(createdArtifact);
    const requestArtifactRef = normalizeString(request?.artifactRef);
    const version = resolveShareableArtifactVersion(createdArtifact);
    if (!artifactRef || version < 1 || artifactRef === requestArtifactRef) {
        return null;
    }
    const savedViewOverlay = extractSavedViewOverlayArtifactState(createdArtifact);
    const publishedSnapshotArtifactRef = normalizeString(
        savedViewOverlay?.publishedSnapshotRef?.artifactRef
        || createdArtifact?.publishedSnapshotArtifactRef
        || (normalizeString(request?.artifactRef) && normalizeString(request?.artifactRef).startsWith("reportBuilder.publishedSnapshot://")
            ? request.artifactRef
            : ""),
    );
    return buildReportViewCreationAuditEvent({
        artifactRef,
        version,
        actorRef: normalizedActorRef,
        occurredAt: normalizeOccurredAt(occurredAt),
        baseArtifactRef: requestArtifactRef,
        publishedSnapshotArtifactRef: createdKind === "reportBuilder.savedView"
            ? publishedSnapshotArtifactRef
            : "",
        metadata: mergeMetadata(request?.metadata, metadata),
    });
}

export async function recordReportBuilderLifecycleAuditEvent(request = null, {
    handler = null,
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const resolvedHandler = resolveReportBuilderAuditHandler(handler);
    if (!resolvedHandler) {
        return {
            recorded: false,
            skipped: true,
            issue: "",
            event: null,
        };
    }
    if (!normalizeString(actorRef)) {
        return {
            recorded: false,
            skipped: false,
            issue: "Report audit provider is configured without an actorRef.",
            event: null,
        };
    }
    return recordReportBuilderAuditEvent(
        buildReportBuilderLifecycleAuditEvent(request, {
            actorRef,
            occurredAt,
            metadata,
        }),
        resolvedHandler,
        {
            invalidEventMessage: "Could not prepare a lifecycle audit event for this report action.",
        },
    );
}

export async function recordReportBuilderExportAuditEvent(request = null, {
    handler = null,
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const resolvedHandler = resolveReportBuilderAuditHandler(handler);
    if (!resolvedHandler) {
        return {
            recorded: false,
            skipped: true,
            issue: "",
            event: null,
        };
    }
    if (!normalizeString(actorRef)) {
        return {
            recorded: false,
            skipped: false,
            issue: "Report audit provider is configured without an actorRef.",
            event: null,
        };
    }
    return recordReportBuilderAuditEvent(
        buildReportBuilderExportAuditEvent(request, {
            actorRef,
            occurredAt,
            metadata,
        }),
        resolvedHandler,
        {
            invalidEventMessage: "Could not prepare an export audit event for this report action.",
        },
    );
}

export async function recordReportBuilderViewCreationAuditEvent(result = null, request = null, {
    handler = null,
    actorRef = "",
    occurredAt = "",
    metadata = {},
} = {}) {
    const resolvedHandler = resolveReportBuilderAuditHandler(handler);
    if (!resolvedHandler) {
        return {
            recorded: false,
            skipped: true,
            issue: "",
            event: null,
        };
    }
    if (!normalizeString(actorRef)) {
        return {
            recorded: false,
            skipped: false,
            issue: "Report audit provider is configured without an actorRef.",
            event: null,
        };
    }
    return recordReportBuilderAuditEvent(
        buildReportBuilderViewCreationAuditEvent(result, request, {
            actorRef,
            occurredAt,
            metadata,
        }),
        resolvedHandler,
        {
            invalidEventMessage: "Could not prepare a view-creation audit event for this report action.",
        },
    );
}
