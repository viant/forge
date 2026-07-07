import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeReportBuilderSemanticBindingViewState(value = null) {
    if (!isPlainObject(value)) {
        return null;
    }
    const title = normalizeString(value?.title);
    const modelLabel = normalizeString(value?.modelLabel);
    const entityLabel = normalizeString(value?.entityLabel);
    const chips = Array.isArray(value?.chips)
        ? value.chips.map((chip) => normalizeString(chip)).filter(Boolean)
        : [];
    const fieldGroups = Array.isArray(value?.fieldGroups)
        ? value.fieldGroups
            .filter((group) => isPlainObject(group))
            .map((group) => {
                const id = normalizeString(group?.id);
                const groupTitle = normalizeString(group?.title);
                const fields = Array.isArray(group?.fields)
                    ? group.fields
                        .filter((field) => isPlainObject(field)
                            && (
                                normalizeString(field?.id)
                                || normalizeString(field?.rawId)
                                || normalizeString(field?.label)
                                || normalizeString(field?.definitionRef)
                            ))
                        .map((field) => cloneValue(field))
                    : [];
                if (!id || !groupTitle || fields.length === 0) {
                    return null;
                }
                return {
                    id,
                    title: groupTitle,
                    fields,
                };
            })
            .filter(Boolean)
        : [];
    if (chips.length === 0 && fieldGroups.length === 0) {
        return null;
    }
    return {
        ...(title ? { title } : { title: "Semantic Binding" }),
        ...(modelLabel ? { modelLabel } : {}),
        ...(entityLabel ? { entityLabel } : {}),
        ...(chips.length > 0 ? { chips } : {}),
        ...(fieldGroups.length > 0 ? { fieldGroups } : {}),
    };
}

function scoreSemanticBindingField(field = null) {
    if (!isPlainObject(field)) {
        return 0;
    }
    const id = normalizeString(field?.id);
    const rawId = normalizeString(field?.rawId);
    const label = normalizeString(field?.label);
    return 0
        + (label && label !== id && label !== rawId ? 2 : 0)
        + (normalizeString(field?.category) ? 1 : 0)
        + (normalizeString(field?.definitionRef) ? 1 : 0)
        + (normalizeString(field?.description) ? 1 : 0)
        + (normalizeString(field?.format) ? 1 : 0)
        + (normalizeString(field?.semanticDataType) ? 1 : 0)
        + (normalizeString(field?.governance?.status) ? 1 : 0)
        + (normalizeString(field?.governance?.certification) ? 1 : 0)
        + (normalizeString(field?.governance?.ownerRef) ? 1 : 0);
}

export function scoreReportBuilderSemanticBindingViewState(value = null) {
    if (!isPlainObject(value)) {
        return 0;
    }
    const fieldGroups = Array.isArray(value?.fieldGroups) ? value.fieldGroups : [];
    const fieldScore = fieldGroups.reduce((total, group) => {
        const fields = Array.isArray(group?.fields) ? group.fields : [];
        return total + fields.reduce((sum, field) => sum + scoreSemanticBindingField(field), 0);
    }, 0);
    return 0
        + (normalizeString(value?.modelLabel) ? 3 : 0)
        + (normalizeString(value?.entityLabel) ? 3 : 0)
        + (Array.isArray(value?.chips) && value.chips.length > 0 ? 1 : 0)
        + (fieldGroups.length > 0 ? 1 : 0)
        + fieldScore;
}

export function buildReportBuilderSemanticBindingViewStateFromMetadataContext(metadataContext = null) {
    return buildReportBuilderSemanticBindingViewState({
        semanticSummary: metadataContext?.semanticSummary || null,
        binding: metadataContext?.binding || null,
    });
}

export function resolvePreferredReportBuilderSemanticBindingViewState({
    metadataContexts = [],
    candidates = [],
} = {}) {
    const metadataStates = (Array.isArray(metadataContexts) ? metadataContexts : [metadataContexts])
        .map((metadataContext) => buildReportBuilderSemanticBindingViewStateFromMetadataContext(metadataContext))
        .filter(Boolean);
    const preferredMetadataState = metadataStates.reduce((best, current) => (
        scoreReportBuilderSemanticBindingViewState(current) > scoreReportBuilderSemanticBindingViewState(best)
            ? current
            : best
    ), null);
    for (const candidate of (Array.isArray(candidates) ? candidates : [candidates])) {
        const normalized = normalizeReportBuilderSemanticBindingViewState(candidate);
        if (!normalized) {
            continue;
        }
        if (
            preferredMetadataState
            && scoreReportBuilderSemanticBindingViewState(preferredMetadataState) > scoreReportBuilderSemanticBindingViewState(normalized)
        ) {
            return preferredMetadataState;
        }
        return normalized;
    }
    return preferredMetadataState;
}
