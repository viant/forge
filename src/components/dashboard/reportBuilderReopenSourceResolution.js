import { normalizeReportBuilderSavedReportRecords } from "./reportBuilderSavedReportRecords.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSavedViewOverlaySourceKind(value = "") {
    const normalized = normalizeString(value);
    return normalized === "reportBuilder.savedView"
        || normalized === "reportBuilder.publishedSnapshot"
        || normalized === "reportBuilder.savedReportPayload"
        ? normalized
        : "";
}

function normalizeReportBuilderReopenResolvedSource(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const kind = normalizeString(value?.kind);
    const payloadId = normalizeString(value?.payloadId);
    const sourceArtifactId = normalizeString(value?.sourceArtifactId);
    const reportId = normalizeString(value?.reportId || value?.reportRef?.reportId);
    if (!kind && !payloadId && !sourceArtifactId && !reportId) {
        return null;
    }
    return {
        ...(kind ? { kind } : {}),
        ...(payloadId ? { payloadId } : {}),
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
        ...(reportId ? { reportId } : {}),
    };
}

export function resolveReportBuilderSavedViewOverlayReferencedRecord(ref = null, localSavedPayloads = [], {
    expectedSourceKind = "",
    requireExactVersion = false,
} = {}) {
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
        return { record: null, reason: "missingRef" };
    }
    const normalizedExpectedSourceKind = normalizeSavedViewOverlaySourceKind(expectedSourceKind);
    const artifactRef = normalizeString(ref?.artifactRef);
    const sourceArtifactId = normalizeString(ref?.sourceArtifactId);
    const reportId = normalizeString(ref?.reportId);
    const documentVersion = normalizePositiveInteger(ref?.documentVersion);
    const candidates = normalizeReportBuilderSavedReportRecords(localSavedPayloads)
        .filter((record) => {
            const sourceKind = normalizeString(record?.source?.kind);
            if (normalizedExpectedSourceKind && sourceKind !== normalizedExpectedSourceKind) {
                return false;
            }
            if (sourceArtifactId && normalizeString(record?.source?.sourceArtifactId) !== sourceArtifactId) {
                return false;
            }
            if (reportId && normalizeString(record?.reportId) !== reportId) {
                return false;
            }
            if (artifactRef && artifactRef.startsWith("report://")) {
                const artifactReportId = normalizeString(artifactRef.slice("report://".length));
                if (artifactReportId && normalizeString(record?.reportId) !== artifactReportId) {
                    return false;
                }
            }
            return true;
        })
        .sort((left, right) => Number(right?.documentVersion || 0) - Number(left?.documentVersion || 0));
    if (candidates.length === 0) {
        return { record: null, reason: "notFound" };
    }
    if (documentVersion > 0) {
        const exact = candidates.find((record) => Number(record?.documentVersion || 0) === documentVersion) || null;
        if (exact) {
            return { record: exact, reason: "" };
        }
        return {
            record: requireExactVersion ? null : candidates[0],
            reason: "versionMismatch",
            requestedVersion: documentVersion,
            resolvedVersion: Number(candidates[0]?.documentVersion || 0) || 0,
        };
    }
    return { record: candidates[0], reason: "" };
}

export function buildReportBuilderReopenSourceResolutionValue(source = null) {
    const normalizedSource = normalizeReportBuilderReopenResolvedSource(source);
    const sourceArtifactId = normalizeString(normalizedSource?.sourceArtifactId);
    const payloadId = normalizeString(normalizedSource?.payloadId);
    const reportId = normalizeString(normalizedSource?.reportId);
    const primaryValue = sourceArtifactId || payloadId || reportId;
    return [
        primaryValue,
        reportId && reportId !== primaryValue && reportId !== sourceArtifactId && reportId !== payloadId ? reportId : "",
    ].filter(Boolean).join(" • ");
}

export function buildReportBuilderReopenSourceResolutionEntry(source = null, {
    id = "",
    label = "",
} = {}) {
    const normalizedSource = normalizeReportBuilderReopenResolvedSource(source);
    const normalizedId = normalizeString(id);
    const normalizedLabel = normalizeString(label);
    const fallbackValue = normalizeString(source?.value);
    if ((!normalizedSource && !fallbackValue) || !normalizedId || !normalizedLabel) {
        return null;
    }
    const value = buildReportBuilderReopenSourceResolutionValue(normalizedSource) || fallbackValue;
    return {
        id: normalizedId,
        label: normalizedLabel,
        ...(value ? { value } : {}),
        ...(normalizedSource ? { source: cloneValue(normalizedSource) } : {}),
    };
}

export function buildReportBuilderReopenSourceResolutionState({
    baseSource = null,
    publishedSnapshotSource = null,
} = {}) {
    const entries = [
        buildReportBuilderReopenSourceResolutionEntry(publishedSnapshotSource, {
            id: "publishedSnapshot",
            label: "Published snapshot",
        }),
        buildReportBuilderReopenSourceResolutionEntry(baseSource, {
            id: "baseReport",
            label: "Base report file",
        }),
    ].filter(Boolean);
    if (entries.length === 0) {
        return null;
    }
    const sourceKinds = entries.map((entry) => normalizeString(entry?.label).toLowerCase()).filter(Boolean);
    const text = entries.length === 1
        ? `Resolved reopen against the ${sourceKinds[0]}.`
        : `Resolved reopen against the ${sourceKinds.slice(0, -1).join(", ")} and ${sourceKinds[sourceKinds.length - 1]}.`;
    return {
        reopenSourceResolutionTitle: "Resolved Reopen Sources",
        reopenSourceResolutionText: text,
        reopenSourceResolutionChips: entries.map((entry) => [entry.label, normalizeString(entry?.value)].filter(Boolean).join(" ")),
        reopenSourceResolutionSources: entries,
    };
}

export function resolveReportBuilderSavedViewOverlayReopenSourceResolution(savedViewOverlay = null, localSavedPayloads = []) {
    const baseResolution = savedViewOverlay?.baseReportRef
        ? resolveReportBuilderSavedViewOverlayReferencedRecord(savedViewOverlay.baseReportRef, localSavedPayloads, {
            expectedSourceKind: "reportBuilder.savedReportPayload",
        })
        : { record: null, reason: "missingRef" };
    const publishedSnapshotResolution = savedViewOverlay?.publishedSnapshotRef
        ? resolveReportBuilderSavedViewOverlayReferencedRecord(savedViewOverlay.publishedSnapshotRef, localSavedPayloads, {
            expectedSourceKind: "reportBuilder.publishedSnapshot",
        })
        : { record: null, reason: "missingRef" };
    const baseSource = normalizeReportBuilderReopenResolvedSource(baseResolution?.record?.source);
    const publishedSnapshotSource = normalizeReportBuilderReopenResolvedSource(publishedSnapshotResolution?.record?.source);
    return {
        baseResolution,
        publishedSnapshotResolution,
        baseRecord: baseResolution?.record || null,
        publishedSnapshotRecord: publishedSnapshotResolution?.record || null,
        baseSource,
        publishedSnapshotSource,
        state: buildReportBuilderReopenSourceResolutionState({
            baseSource,
            publishedSnapshotSource,
        }),
    };
}
