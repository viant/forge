import { resolvePreferredReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewPreference.js";

export function resolveReportBuilderInlineSemanticBindingViewState({
    currentSemanticSummary = null,
    currentBinding = null,
    reopenedSemanticSummary = null,
    reopenedBinding = null,
} = {}) {
    return resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [
            {
                semanticSummary: currentSemanticSummary || null,
                binding: currentBinding || null,
            },
            {
                semanticSummary: reopenedSemanticSummary || null,
                binding: reopenedBinding || null,
            },
        ],
    });
}
