import {
    buildImportedLocalGetReportDocumentResponseIdentity,
} from "./reportBuilderImportedArtifactState.js";
import { normalizeReportBuilderSavedReportRecord } from "./reportBuilderSavedReportRecords.js";
import {
    resolveNormalizedReportSpecDocumentContext,
    resolveNormalizedSavedReportRecordContext,
} from "./reportBuilderSavedRecordMetadataContext.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildImportedLocalReopenablePanelSeedEntry(response = null) {
    if (!isPlainObject(response)) {
        return null;
    }
    const context = resolveNormalizedReportSpecDocumentContext({
        reportSpec: response?.reportSpec || null,
        document: response?.document || null,
        title: response?.document?.title || response?.reportRef?.reportId || "",
    });
    const id = normalizeString(buildImportedLocalGetReportDocumentResponseIdentity(response));
    const title = normalizeString(context?.document?.title || response?.document?.title || response?.reportRef?.reportId);
    const reportId = normalizeString(response?.reportRef?.reportId || response?.document?.id);
    if (!id || !title || !reportId) {
        return null;
    }
    return {
        id,
        title,
        reportId,
        documentVersion: Number(response?.documentVersion || 0) || 0,
        importedArtifactKind: normalizeString(response?.importedArtifactKind),
        source: response?.source || null,
        savedViewOverlay: response?.savedViewOverlay || null,
        reportSpec: context?.reportSpec ? cloneValue(context.reportSpec) : null,
        document: context?.document ? cloneValue(context.document) : null,
        semanticSummary: context?.semanticSummary ? cloneValue(context.semanticSummary) : null,
        binding: context?.binding ? cloneValue(context.binding) : null,
        scopeParams: Array.isArray(context?.scopeParams) ? cloneValue(context.scopeParams) : [],
        ...(isPlainObject(response?.semanticBindingViewState)
            ? { semanticBindingViewState: cloneValue(response.semanticBindingViewState) }
            : {}),
    };
}

export function buildImportedLocalSavedRecordPanelSeedEntry(record = null) {
    const normalizedRecord = normalizeReportBuilderSavedReportRecord(record);
    if (!normalizedRecord) {
        return null;
    }
    const context = resolveNormalizedSavedReportRecordContext(normalizedRecord);
    const id = normalizeString(
        record?.id
        || normalizedRecord?.id
        || [
            normalizeString(normalizedRecord?.source?.kind),
            normalizeString(normalizedRecord?.source?.payloadId),
            normalizeString(normalizedRecord?.source?.sourceArtifactId),
            normalizeString(normalizedRecord?.reportId),
        ].filter(Boolean).join("::"),
    );
    const title = normalizeString(context?.title || normalizedRecord?.title || normalizedRecord?.reportId);
    const reportId = normalizeString(normalizedRecord?.reportId);
    if (!id || !title || !reportId) {
        return null;
    }
    return {
        id,
        title,
        reportId,
        documentVersion: Number(normalizedRecord?.documentVersion || 0) || 0,
        exportable: normalizedRecord?.exportable === true || record?.exportable === true,
        importedArtifactKind: normalizeString(normalizedRecord?.importedArtifactKind),
        source: normalizedRecord?.source || null,
        savedViewOverlay: normalizedRecord?.savedViewOverlay || null,
        savedReportPayload: normalizedRecord?.savedReportPayload || null,
        reportSpec: context?.reportSpec ? cloneValue(context.reportSpec) : null,
        document: context?.document ? cloneValue(context.document) : null,
        semanticSummary: context?.semanticSummary ? cloneValue(context.semanticSummary) : null,
        binding: context?.binding ? cloneValue(context.binding) : null,
        scopeParams: Array.isArray(context?.scopeParams) ? cloneValue(context.scopeParams) : [],
        ...(isPlainObject(record?.semanticBindingViewState)
            ? { semanticBindingViewState: cloneValue(record.semanticBindingViewState) }
            : (isPlainObject(normalizedRecord?.semanticBindingViewState)
            ? { semanticBindingViewState: cloneValue(normalizedRecord.semanticBindingViewState) }
            : (isPlainObject(normalizedRecord?.savedReportPayload?.semanticBindingViewState)
                ? { semanticBindingViewState: cloneValue(normalizedRecord.savedReportPayload.semanticBindingViewState) }
                : {}))),
    };
}
