import {
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";
import {
    backfillImportedDocumentMetadata,
    resolveEmbeddedReportSpec,
} from "./reportBuilderImportedDocumentMetadata.js";
import {
    hasReportBuilderBindingContent as hasBindingContent,
    hasReportBuilderSemanticSummaryContent as hasSemanticSummaryContent,
    isReportBuilderPlainObject as isPlainObject,
} from "./reportBuilderMetadataContent.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasOwnKeys(value = null) {
    return isPlainObject(value) && Object.keys(value).length > 0;
}

function resolvePreferredObject(primary = null, secondary = null, hasContent = () => false) {
    if (hasContent(primary)) {
        return primary;
    }
    if (hasContent(secondary)) {
        return secondary;
    }
    return primary || secondary || null;
}

export function resolvePreferredScopeParams(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }
    return [];
}

export function resolveNormalizedReportSpecDocumentContext({
    reportSpec = null,
    document = null,
    title = "",
} = {}) {
    const derivedReportSpec = isPlainObject(document)
        ? resolveEmbeddedReportSpec(document)
        : null;
    const normalizedReportSpec = isPlainObject(reportSpec)
        ? (
            hasOwnKeys(reportSpec)
                ? reportSpec
                : derivedReportSpec
        )
        : derivedReportSpec;
    const normalizedDocument = isPlainObject(document)
        ? backfillImportedDocumentMetadata(document, normalizedReportSpec)
        : null;
    const scopeParams = resolvePreferredScopeParams(
        normalizedReportSpec?.scope?.params,
        normalizedDocument?.scope?.params,
    );
    const scope = Array.isArray(normalizedReportSpec?.scope?.params) && normalizedReportSpec.scope.params.length > 0
        ? normalizedReportSpec.scope
        : (
            normalizedDocument?.scope
            || normalizedReportSpec?.scope
            || null
        );
    const semanticSummary = resolvePreferredObject(
        normalizedReportSpec?.semanticSummary,
        normalizedDocument?.semanticSummary,
        hasSemanticSummaryContent,
    );
    const binding = resolvePreferredObject(
        normalizedReportSpec?.binding,
        normalizedDocument?.binding,
        hasBindingContent,
    );
    const enrichedReportSpec = isPlainObject(normalizedReportSpec)
        ? {
            ...cloneValue(normalizedReportSpec),
            ...(!hasSemanticSummaryContent(normalizedReportSpec?.semanticSummary) && hasSemanticSummaryContent(semanticSummary)
                ? { semanticSummary: cloneValue(semanticSummary) }
                : {}),
            ...(!hasBindingContent(normalizedReportSpec?.binding) && hasBindingContent(binding)
                ? { binding: cloneValue(binding) }
                : {}),
            ...(!(Array.isArray(normalizedReportSpec?.scope?.params) && normalizedReportSpec.scope.params.length > 0)
                && isPlainObject(scope)
                ? { scope: cloneValue(scope) }
                : {}),
        }
        : normalizedReportSpec;
    return {
        reportSpec: enrichedReportSpec,
        document: normalizedDocument,
        title: normalizeString(title || normalizedDocument?.title || normalizedReportSpec?.title || ""),
        semanticSummary,
        binding,
        scope,
        scopeParams,
    };
}

export function resolveNormalizedSavedReportRecordContext(record = null) {
    if (!isPlainObject(record)) {
        return null;
    }
    const reportSpec = isPlainObject(record?.reportSpec)
        ? record.reportSpec
        : (
            isPlainObject(record?.savedReportPayload?.reportSpec)
                ? record.savedReportPayload.reportSpec
                : null
        );
    const document = isPlainObject(record?.document)
        ? backfillImportedDocumentMetadata(record.document, reportSpec)
        : (
            isPlainObject(record?.savedReportPayload?.reportDocument)
                ? backfillImportedDocumentMetadata(record.savedReportPayload.reportDocument, reportSpec)
                : null
        );
    return {
        record,
        ...resolveNormalizedReportSpecDocumentContext({
            reportSpec,
            document,
            title: record?.title || "",
        }),
    };
}

export function resolveSavedReportRecordContextBySource(source = null, localSavedPayloads = []) {
    const record = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, source);
    return record ? resolveNormalizedSavedReportRecordContext(record) : null;
}

export function resolveSavedReportRecordContextByReportId(reportId = "", localSavedPayloads = []) {
    const record = resolveReportBuilderSavedReportRecordByReportId(localSavedPayloads, reportId);
    return record ? resolveNormalizedSavedReportRecordContext(record) : null;
}
