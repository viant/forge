import {
    normalizeReportBuilderLifecycleSharedArtifactRecord,
} from "./reportBuilderLifecycleResult.js";
import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecords,
} from "./reportBuilderSavedReportRecords.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function resolveReportBuilderSharedArtifactHandler(value = null) {
    const handler = isPlainObject(value) ? value : null;
    const listArtifacts = typeof handler?.listArtifacts === "function"
        ? handler.listArtifacts
        : null;
    const getArtifact = typeof handler?.getArtifact === "function"
        ? handler.getArtifact
        : null;
    if (!listArtifacts && !getArtifact) {
        return null;
    }
    return {
        ...(listArtifacts ? { listArtifacts } : {}),
        ...(getArtifact ? { getArtifact } : {}),
    };
}

export function normalizeReportBuilderSharedArtifactInventory(value = null) {
    const items = Array.isArray(value)
        ? value
        : (Array.isArray(value?.artifacts) ? value.artifacts : []);
    return items
        .map((entry) => normalizeReportBuilderLifecycleSharedArtifactRecord(entry))
        .filter(Boolean);
}

export function resolveReportBuilderSharedArtifactInventoryRecord(records = [], value = null) {
    const normalizedRecords = normalizeReportBuilderSavedReportRecords(records);
    const normalizedArtifactId = normalizeString(value?.artifactId || value?.id);
    if (normalizedArtifactId) {
        const artifactMatchedRecord = normalizedRecords.find((record) => (
            normalizeString(record?.artifactId || record?.id) === normalizedArtifactId
        ));
        if (artifactMatchedRecord) {
            return artifactMatchedRecord;
        }
    }
    const sourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(value?.source || value);
    if (sourceIdentity) {
        const sourceMatchedRecord = normalizedRecords.find((record) => (
            record?.sourceIdentity
            && matchesReportBuilderSavedPayloadSourceIdentity(sourceIdentity, record.sourceIdentity)
        ));
        if (sourceMatchedRecord) {
            return sourceMatchedRecord;
        }
    }
    const reportId = normalizeString(value?.reportRef?.reportId || value?.reportId);
    if (!reportId) {
        return null;
    }
    return normalizedRecords
        .filter((record) => normalizeString(record?.reportId) === reportId)
        .sort((left, right) => Number(right?.exportable === true) - Number(left?.exportable === true))[0]
        || null;
}

export function mergeReportBuilderSharedArtifactInventoryRecord(records = [], value = null) {
    const normalizedRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(value);
    const currentRecords = normalizeReportBuilderSavedReportRecords(records);
    if (!normalizedRecord) {
        return currentRecords;
    }
    const normalizedArtifactId = normalizeString(normalizedRecord?.artifactId || normalizedRecord?.id);
    const sourceIdentity = normalizedRecord?.sourceIdentity
        || normalizeReportBuilderSavedPayloadSourceIdentity(normalizedRecord?.source || normalizedRecord);
    let replaced = false;
    const nextRecords = currentRecords.map((record) => {
        const artifactMatch = normalizedArtifactId
            && normalizeString(record?.artifactId || record?.id) === normalizedArtifactId;
        const sourceMatch = sourceIdentity
            && record?.sourceIdentity
            && matchesReportBuilderSavedPayloadSourceIdentity(sourceIdentity, record.sourceIdentity);
        if (!replaced && (artifactMatch || sourceMatch)) {
            replaced = true;
            return normalizedRecord;
        }
        return record;
    });
    return replaced ? nextRecords : [normalizedRecord, ...currentRecords];
}

export function buildReportBuilderSharedArtifactInventoryNotice({
    loading = false,
    error = "",
    recordCount = 0,
} = {}) {
    const normalizedError = normalizeString(error);
    if (normalizedError) {
        return {
            level: "warning",
            message: normalizedError,
        };
    }
    if (loading) {
        return {
            level: "info",
            message: "Loading shared artifact inventory.",
        };
    }
    if (Number(recordCount || 0) > 0) {
        return {
            level: "info",
            message: `${Number(recordCount || 0)} shared reporting artifact${Number(recordCount || 0) === 1 ? "" : "s"} available from the backend inventory.`,
        };
    }
    return null;
}
