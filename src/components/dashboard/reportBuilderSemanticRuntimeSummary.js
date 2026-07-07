import {
    buildReportBuilderSemanticBindingViewStateFromMetadataContext,
    scoreReportBuilderSemanticBindingViewState,
} from "./reportBuilderSemanticBindingViewPreference.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function buildMetadataContext(summary = null, binding = null) {
    return {
        semanticSummary: summary || null,
        binding: binding || null,
    };
}

export function resolveReportBuilderSemanticRuntimeSummary({
    resolvedSemanticSummary = null,
    currentBinding = null,
    reopenedSemanticSummary = null,
    reopenedBinding = null,
    semanticStatusTitle = "",
    semanticStatusMessage = "",
} = {}) {
    if (!resolvedSemanticSummary) {
        return reopenedSemanticSummary || null;
    }
    if (!reopenedSemanticSummary) {
        return resolvedSemanticSummary || null;
    }
    const loadingSemanticModel = normalizeString(semanticStatusTitle).toLowerCase() === "semantic model"
        && normalizeString(semanticStatusMessage) === "Loading semantic model metadata…";
    const resolvedUsesRawBindingIdentity = (
        (!normalizeString(resolvedSemanticSummary?.modelLabel) && !normalizeString(resolvedSemanticSummary?.entityLabel))
        || normalizeString(resolvedSemanticSummary?.modelLabel) === normalizeString(currentBinding?.modelRef)
        || normalizeString(resolvedSemanticSummary?.entityLabel) === normalizeString(currentBinding?.entity)
    );
    if (!loadingSemanticModel && !resolvedUsesRawBindingIdentity) {
        return resolvedSemanticSummary || reopenedSemanticSummary || null;
    }
    const resolvedViewState = buildReportBuilderSemanticBindingViewStateFromMetadataContext(
        buildMetadataContext(resolvedSemanticSummary, currentBinding),
    );
    const reopenedViewState = buildReportBuilderSemanticBindingViewStateFromMetadataContext(
        buildMetadataContext(reopenedSemanticSummary, reopenedBinding),
    );
    if (
        scoreReportBuilderSemanticBindingViewState(reopenedViewState)
        > scoreReportBuilderSemanticBindingViewState(resolvedViewState)
    ) {
        return reopenedSemanticSummary;
    }
    return resolvedSemanticSummary || reopenedSemanticSummary || null;
}
