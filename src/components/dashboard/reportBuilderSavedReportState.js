import {
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildReportBuilderSavedReportState({
    savedReportPayload = null,
    currentSavedRecord = null,
    configuredSavedPayloads = [],
    reopenedSource = null,
    reopenedReportId = "",
    selectedListEntry = null,
} = {}) {
    const rawLocalSavedPayloads = [
        ...(currentSavedRecord ? [currentSavedRecord] : []),
        ...(savedReportPayload ? [savedReportPayload] : []),
        ...(Array.isArray(configuredSavedPayloads) ? configuredSavedPayloads : []),
    ];
    const localSavedReportRecords = normalizeReportBuilderSavedReportRecords(rawLocalSavedPayloads);
    const normalizedReopenedReportId = normalizeString(reopenedReportId);
    const resolvedCurrentSavedRecord = resolveReportBuilderSavedReportRecordBySource(localSavedReportRecords, savedReportPayload)
        || null;
    const reopenedSavedRecord = resolveReportBuilderSavedReportRecordBySource(localSavedReportRecords, reopenedSource)
        || (normalizedReopenedReportId
            ? resolveReportBuilderSavedReportRecordByReportId(localSavedReportRecords, normalizedReopenedReportId)
            : null)
        || null;
    const selectedListEntrySavedRecord = resolveReportBuilderSavedReportRecordBySource(
        localSavedReportRecords,
        selectedListEntry?.source || selectedListEntry,
    ) || null;
    return {
        rawLocalSavedPayloads: rawLocalSavedPayloads.map((entry) => cloneValue(entry)),
        localSavedReportRecords,
        currentSavedRecord: resolvedCurrentSavedRecord,
        reopenedSavedRecord,
        selectedListEntrySavedRecord,
        savedReportPayloadExportRequest: cloneValue(resolvedCurrentSavedRecord?.exportRequest || null),
        reopenedExportRequest: cloneValue(reopenedSavedRecord?.exportRequest || null),
        selectedListEntryExportRequest: cloneValue(selectedListEntrySavedRecord?.exportRequest || null),
    };
}
