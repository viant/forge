function normalizeString(value = "") {
    return String(value || "").trim();
}

export function isReportBuilderPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function hasReportBuilderArrayEntries(value = []) {
    return Array.isArray(value) && value.length > 0;
}

export function hasReportBuilderSemanticSummaryContent(value = null) {
    return isReportBuilderPlainObject(value) && (
        normalizeString(value?.modelRef)
        || normalizeString(value?.modelLabel)
        || normalizeString(value?.modelDescription)
        || normalizeString(value?.entity)
        || normalizeString(value?.entityLabel)
        || normalizeString(value?.entityDescription)
        || hasReportBuilderArrayEntries(value?.selectedDimensions)
        || hasReportBuilderArrayEntries(value?.selectedMeasures)
        || hasReportBuilderArrayEntries(value?.selectedParameters)
    );
}

export function hasReportBuilderBindingContent(value = null) {
    return isReportBuilderPlainObject(value) && (
        normalizeString(value?.mode)
        || normalizeString(value?.modelRef)
        || normalizeString(value?.entity)
        || hasReportBuilderArrayEntries(value?.selectedDimensions)
        || hasReportBuilderArrayEntries(value?.selectedMeasures)
    );
}

export function hasReportBuilderScopeParamsContent(value = null) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return (Array.isArray(value?.scopeParams) && value.scopeParams.length > 0)
        || (Array.isArray(value?.scope?.params) && value.scope.params.length > 0);
}

export function hasReportBuilderMetadataContextContent(value = null) {
    return hasReportBuilderSemanticSummaryContent(value?.semanticSummary)
        || hasReportBuilderBindingContent(value?.binding)
        || hasReportBuilderScopeParamsContent(value);
}
