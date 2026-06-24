import { buildGetReportDocumentRequest } from "../../reporting/reportDocumentStore.js";

import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import {
    buildReportBuilderListReportDocumentsEntrySelectionKey,
    resolveReportBuilderListReportDocumentsResponseEntry,
} from "./reportBuilderReportDocumentReadResponse.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

export function buildReportBuilderGetReportDocumentRequest(listResponse = null, {
    entryReportId = "",
    entrySelectionKey = "",
} = {}) {
    const entry = resolveReportBuilderListReportDocumentsResponseEntry(listResponse, {
        selectedEntryKey: entrySelectionKey,
        selectedReportId: entryReportId,
    });
    const targetReportId = normalizeString(entry?.reportRef?.reportId || entryReportId);
    if (!targetReportId || !entry) {
        return null;
    }
    const request = buildGetReportDocumentRequest({
        reportId: targetReportId,
    });
    if (!request) {
        return null;
    }
    const source = entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source)
        ? cloneValue(entry.source)
        : null;
    const listEntrySelectionKey = buildReportBuilderListReportDocumentsEntrySelectionKey(entry);
    return {
        ...request,
        ...(source ? { source } : {}),
        ...(listEntrySelectionKey ? { listEntrySelectionKey } : {}),
    };
}

function normalizeMetadataContext(context = null) {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
        return null;
    }
    const normalizedContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: context?.reportSpec || null,
        document: context?.document || null,
        title: context?.title || "",
    });
    const title = normalizeString(context?.title || normalizedContext?.title);
    const subtitle = normalizeString(context?.subtitle || normalizedContext?.document?.subtitle || context?.document?.subtitle);
    const description = normalizeString(context?.description || normalizedContext?.document?.description || context?.document?.description);
    const derivedSemanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: context?.semanticSummary || normalizedContext?.semanticSummary || null,
        binding: context?.binding || normalizedContext?.binding || null,
    });
    const carriedSemanticBindingChips = Array.isArray(context?.semanticBindingChips)
        ? context.semanticBindingChips.map((chip) => normalizeString(chip)).filter(Boolean)
        : [];
    const carriedSemanticBindingFieldGroups = (Array.isArray(context?.semanticBindingFieldGroups) ? context.semanticBindingFieldGroups : [])
        .filter((group) => group && typeof group === "object" && !Array.isArray(group))
        .map((group) => ({
            id: normalizeString(group?.id),
            title: normalizeString(group?.title),
            fields: (Array.isArray(group?.fields) ? group.fields : [])
                .filter((field) => field && typeof field === "object" && !Array.isArray(field)),
        }))
        .filter((group) => group.id && group.title && group.fields.length > 0);
    const semanticBindingViewState = derivedSemanticBindingViewState || (
        carriedSemanticBindingChips.length > 0 || carriedSemanticBindingFieldGroups.length > 0
            ? {
                title: normalizeString(context?.semanticBindingTitle || "Semantic Binding") || "Semantic Binding",
                ...(carriedSemanticBindingChips.length > 0 ? { chips: carriedSemanticBindingChips } : {}),
                ...(carriedSemanticBindingFieldGroups.length > 0 ? { fieldGroups: carriedSemanticBindingFieldGroups } : {}),
            }
            : null
    );
    const scopeSummary = Array.isArray(context?.scopeSummaryItems) && context.scopeSummaryItems.length > 0
        ? {
            title: normalizeString(context?.scopeSummaryTitle || "Report Scope"),
            text: normalizeString(context?.scopeSummaryText),
            items: context.scopeSummaryItems.map((item) => ({
                id: normalizeString(item?.id),
                label: normalizeString(item?.label || item?.id),
                ...(normalizeString(item?.description) ? { description: normalizeString(item.description) } : {}),
            })).filter((item) => item.id && item.label),
        }
        : buildReportBuilderScopeSummaryFromParams(
            context?.scopeParams
            || normalizedContext?.scopeParams,
        );
    if (!title && !subtitle && !description && !semanticBindingViewState && (!Array.isArray(scopeSummary?.items) || scopeSummary.items.length === 0)) {
        return null;
    }
    return {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: normalizeString(scopeSummary?.title || "Report Scope") || "Report Scope",
            scopeSummaryText: normalizeString(scopeSummary?.text),
            scopeSummaryItems: scopeSummary.items,
        } : {}),
    };
}

export function buildReportBuilderGetReportDocumentRequestSummary(request = null, {
    metadata = null,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return null;
    }
    const normalizedMetadata = normalizeMetadataContext(metadata);
    return {
        kind: normalizeString(request?.kind),
        reportId: normalizeString(request?.reportRef?.reportId),
        ...(normalizedMetadata?.title ? { title: normalizedMetadata.title } : {}),
        ...(normalizedMetadata?.subtitle ? { subtitle: normalizedMetadata.subtitle } : {}),
        ...(normalizedMetadata?.description ? { description: normalizedMetadata.description } : {}),
        ...(normalizedMetadata?.semanticBindingTitle ? { semanticBindingTitle: normalizedMetadata.semanticBindingTitle } : {}),
        ...(Array.isArray(normalizedMetadata?.semanticBindingChips) ? { semanticBindingChips: normalizedMetadata.semanticBindingChips } : {}),
        ...(Array.isArray(normalizedMetadata?.semanticBindingFieldGroups) && normalizedMetadata.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: normalizedMetadata.semanticBindingFieldGroups }
            : {}),
        ...(normalizedMetadata?.scopeSummaryTitle ? { scopeSummaryTitle: normalizedMetadata.scopeSummaryTitle } : {}),
        ...(normalizedMetadata?.scopeSummaryText ? { scopeSummaryText: normalizedMetadata.scopeSummaryText } : {}),
        ...(Array.isArray(normalizedMetadata?.scopeSummaryItems) && normalizedMetadata.scopeSummaryItems.length > 0
            ? { scopeSummaryItems: normalizedMetadata.scopeSummaryItems }
            : {}),
    };
}

export function serializeReportBuilderGetReportDocumentRequest(request = null, {
    pretty = true,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(request)
        : JSON.stringify(request, null, 2);
}

export function buildReportBuilderGetReportDocumentRequestInspectorState(request = null, {
    metadata = null,
} = {}) {
    const summary = buildReportBuilderGetReportDocumentRequestSummary(request, { metadata });
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
            : {}),
        content: serializeReportBuilderGetReportDocumentRequest(request),
    };
}

export function buildReportBuilderGetReportDocumentRequestDownload(request = null, {
    metadata = null,
} = {}) {
    const summary = buildReportBuilderGetReportDocumentRequestSummary(request, { metadata });
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderGetReportDocumentRequest(request);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-get-report-document-request.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}
